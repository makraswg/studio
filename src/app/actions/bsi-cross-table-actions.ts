
'use server';

import { DataSource, ImportRun } from '@/lib/types';
import { saveCollectionRecord } from './mysql-actions';
import * as XLSX from 'xlsx';

/**
 * Importiert Maßnahmen und deren Relationen zu Gefährdungen aus der BSI Kreuztabelle (Excel).
 * Diese Version ist extrem robust gegenüber Header-Variationen und Blatt-Strukturen.
 * Berücksichtigt, dass Zelle A1 oft Metadaten/Titel enthält.
 */
export async function runBsiCrossTableImportAction(
  base64Content: string, 
  dataSource: DataSource = 'mysql'
): Promise<{ success: boolean; message: string; count: number }> {
  const runId = `run-excel-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();
  let log = `Excel Kreuztabellen-Import gestartet um ${now}\n`;
  
  try {
    const buffer = Buffer.from(base64Content, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    let totalMeasures = 0;
    let totalRelations = 0;
    let processedSheets = 0;

    log += `Workbook geladen. ${workbook.SheetNames.length} Blätter gefunden.\n`;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length === 0) {
        log += `Blatt "${sheetName}" ist leer.\n`;
        continue;
      }

      // --- SCHRITT 1: Header suchen ---
      let headerRowIndex = -1;
      let colMap = {
        baustein: -1,
        mCode: -1,
        mTitel: -1,
        hazards: [] as { code: string, index: number }[]
      };

      // Scan die ersten 50 Zeilen (BSI Excel hat oft lange Header/Legenden oder Titel in A1)
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
          if (val.includes('BAUSTEIN') || val === 'ELEMENT' || val === 'GRUPPE' || val.includes('KOMPONENTE')) {
            currentMap.baustein = idx;
          }
          
          // Maßnahmen-Code erkennen
          if (val.includes('ID') || val.includes('CODE') || val.includes('NR.') || val.includes('MASSNAHMEN-NR') || val === 'NR' || val.includes('BEZEICHNER')) {
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
        // Wir sind hier etwas toleranter: Entweder Baustein oder Code muss da sein
        if (currentMap.hazards.length >= 1 && (currentMap.mCode !== -1 || currentMap.baustein !== -1)) {
          headerRowIndex = i;
          colMap = currentMap;
          break;
        }
      }

      if (headerRowIndex === -1) {
        log += `Blatt "${sheetName}" übersprungen (Keine Kopfzeile mit G 0.x gefunden).\n`;
        continue;
      }

      log += `Verarbeite Blatt "${sheetName}" (Daten ab Zeile ${headerRowIndex + 1}).\n`;
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

        // Schlüsselbildung: Baustein + Code (Normalisiert)
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
          
          // Boolean Presence Logik: Wenn Zelle nicht leer ist, besteht eine Relation
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
      const errorMsg = "Keine relevanten Kreuztabellen-Blätter gefunden. Stellen Sie sicher, dass Spalten wie 'G 0.1' und 'Baustein' vorhanden sind.";
      await saveCollectionRecord('importRuns', runId, {
        id: runId,
        catalogId: 'excel-krt',
        timestamp: now,
        status: 'failed',
        itemCount: 0,
        log: log + `FEHLER: ${errorMsg}`
      }, dataSource);
      
      return { success: false, message: errorMsg, count: 0 };
    }

    const successMsg = `Import abgeschlossen: ${totalMeasures} Maßnahmen und ${totalRelations} Relationen aus ${processedSheets} Blättern identifiziert.`;
    await saveCollectionRecord('importRuns', runId, {
      id: runId,
      catalogId: 'excel-krt',
      timestamp: now,
      status: 'success',
      itemCount: totalMeasures,
      log: log + `ERFOLG: ${successMsg}`
    }, dataSource);

    return { success: true, message: successMsg, count: totalMeasures };
  } catch (error: any) {
    console.error("Excel Import Error:", error);
    await saveCollectionRecord('importRuns', runId, {
      id: runId,
      catalogId: 'excel-krt',
      timestamp: now,
      status: 'failed',
      itemCount: 0,
      log: log + `FEHLER: ${error.message}`
    }, dataSource);
    return { success: false, message: `Fehler beim Import: ${error.message}`, count: 0 };
  }
}
