'use server';

import { DataSource } from '@/lib/types';
import { saveCollectionRecord } from './mysql-actions';
import * as XLSX from 'xlsx';

/**
 * Importiert Maßnahmen und deren Relationen zu Gefährdungen aus der BSI Kreuztabelle (Excel).
 * Diese Version ist extrem robust gegenüber Header-Variationen und Blatt-Strukturen.
 */
export async function runBsiCrossTableImportAction(
  base64Content: string, 
  dataSource: DataSource = 'mysql'
): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const buffer = Buffer.from(base64Content, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    let totalMeasures = 0;
    let totalRelations = 0;
    let processedSheets = 0;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length === 0) continue;

      // --- SCHRITT 1: Header suchen ---
      let headerRowIndex = -1;
      let colMap = {
        baustein: -1,
        mCode: -1,
        mTitel: -1,
        hazards: [] as { code: string, index: number }[]
      };

      // Scan die ersten 50 Zeilen (BSI Excel hat oft lange Header/Legenden)
      for (let i = 0; i < Math.min(rows.length, 50); i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row)) continue;

        const currentMap = {
          baustein: -1,
          mCode: -1,
          mTitel: -1,
          hazards: [] as { code: string, index: number }[]
        };

        row.forEach((cell, idx) => {
          const val = String(cell || '').trim().toUpperCase();
          if (!val) return;
          
          // Baustein-Spalte erkennen
          if (val.includes('BAUSTEIN') || val === 'ELEMENT' || val === 'GRUPPE') {
            currentMap.baustein = idx;
          }
          
          // Maßnahmen-Code erkennen
          if (val.includes('ID') || val.includes('CODE') || val.includes('NR.') || val.includes('MASSNAHMEN-NR') || val === 'NR') {
            currentMap.mCode = idx;
          }
          
          // Titel erkennen
          if (val.includes('TITEL') || val.includes('BEZEICHNUNG') || (val.includes('MASSNAHME') && !val.includes('NR'))) {
            if (currentMap.mTitel === -1) currentMap.mTitel = idx;
          }

          // Gefährdungen erkennen (Regex: G gefolgt von 0. oder 0 und einer Nummer)
          // Erkennt: "G 0.1", "G0.1", "G 0.1 Feuer", "G 0.1 (Elementare Gefährdung)"
          const gMatch = val.match(/G\s*0[.\s]*([0-9]+)/i);
          if (gMatch) {
            currentMap.hazards.push({ 
              code: `G 0.${gMatch[1]}`, 
              index: idx 
            });
          }
        });

        // Ein Blatt ist relevant, wenn Gefährdungen UND Identifikations-Spalten vorhanden sind
        if (currentMap.hazards.length >= 1 && (currentMap.mCode !== -1 || currentMap.baustein !== -1)) {
          headerRowIndex = i;
          colMap = currentMap;
          break;
        }
      }

      if (headerRowIndex === -1) continue;
      processedSheets++;

      // --- SCHRITT 2: Daten verarbeiten ---
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row)) continue;

        const baustein = String(row[colMap.baustein] || '').trim();
        const mCode = String(row[colMap.mCode] || '').trim();
        const mTitel = String(row[colMap.mTitel] || '').trim();

        // Zeile überspringen wenn keine Identifikation möglich
        if (!mCode && !baustein) continue;

        // Schlüsselbildung: Baustein + Code
        const cleanMCode = mCode || 'M-UNKNOWN';
        const cleanBaustein = baustein || 'GLOBAL';
        const measureId = `m-${cleanBaustein}-${cleanMCode}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        // Maßnahme speichern
        await saveCollectionRecord('hazardMeasures', measureId, {
          id: measureId,
          code: cleanMCode,
          title: mTitel || cleanMCode,
          baustein: cleanBaustein
        }, dataSource);
        totalMeasures++;

        // Relationen zu den gefundenen G-Spalten prüfen
        for (const hCol of colMap.hazards) {
          const cellVal = row[hCol.index];
          
          // Boolean Presence Logik
          if (cellVal !== undefined && cellVal !== null && String(cellVal).trim() !== '') {
            const relId = `rel-${measureId}-${hCol.code.replace(/[^a-z0-9]/gi, '_')}`.toLowerCase();
            
            await saveCollectionRecord('hazardMeasureRelations', relId, {
              id: relId,
              measureId: measureId,
              hazardCode: hCol.code
            }, dataSource);
            totalRelations++;
          }
        }
      }
    }

    if (processedSheets === 0) {
      return { 
        success: false, 
        message: "Keine relevanten Kreuztabellen-Blätter gefunden. Stellen Sie sicher, dass Spalten wie 'G 0.1' und 'Maßnahmen-Nr' vorhanden sind.",
        count: 0 
      };
    }

    return { 
      success: true, 
      message: `Import abgeschlossen: ${totalMeasures} Maßnahmen und ${totalRelations} Relationen aus ${processedSheets} relevanten Blättern identifiziert.`,
      count: totalMeasures
    };
  } catch (error: any) {
    console.error("Excel Import Error:", error);
    return { success: false, message: `Fehler beim Import: ${error.message}`, count: 0 };
  }
}
