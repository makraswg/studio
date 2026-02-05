'use server';

import { DataSource, ImportRun } from '@/lib/types';
import { saveCollectionRecord } from './mysql-actions';
import * as XLSX from 'xlsx';

/**
 * Importiert Maßnahmen und deren Relationen zu Gefährdungen aus der BSI Kreuztabelle (Excel).
 * Optimiert für Header-Strukturen wie: [Baustein-Code] | Name | CIA | G 0.x
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
      // Wir nutzen {header: 1} um ein Array von Arrays zu erhalten (AOA)
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

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

      // Scan die ersten 50 Zeilen nach Gefährdungs-Codes (G 0.x)
      for (let i = 0; i < Math.min(rows.length, 50); i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row)) continue;

        const currentHazards: { code: string, index: number }[] = [];
        let foundBausteinLabel = -1;
        let foundTitleLabel = -1;
        let foundCodeLabel = -1;

        row.forEach((cell, idx) => {
          const val = String(cell || '').trim();
          if (!val) return;
          
          // 1. Gefährdungen erkennen (G 0.1, G 0.15 etc)
          const gMatch = val.match(/G\s*0[.\s]*([0-9]+)/i);
          if (gMatch) {
            currentHazards.push({ 
              code: `G 0.${gMatch[1]}`, 
              index: idx 
            });
            return;
          }

          // 2. Kernspalten erkennen
          const upperVal = val.toUpperCase();
          
          // Baustein-Spalte (Entweder Label "Baustein" oder ein Code-Muster wie NET.2.2)
          if (upperVal.includes('BAUSTEIN') || upperVal === 'ELEMENT' || /^[A-Z]{2,4}\.[0-9]+/.test(val)) {
            if (foundBausteinLabel === -1) foundBausteinLabel = idx;
          }
          
          // Titel-Spalte
          if (upperVal === 'NAME' || upperVal === 'TITEL' || upperVal === 'BEZEICHNUNG' || (upperVal.includes('MASSNAHME') && !upperVal.includes('NR'))) {
            if (foundTitleLabel === -1) foundTitleLabel = idx;
          }

          // Code-Spalte (M 1.1 etc)
          if (upperVal.includes('ID') || upperVal.includes('CODE') || upperVal.includes('NR.') || upperVal === 'NR') {
            if (foundCodeLabel === -1) foundCodeLabel = idx;
          }
        });

        // Ein Blatt ist relevant, wenn Gefährdungen vorhanden sind
        if (currentHazards.length >= 1) {
          headerRowIndex = i;
          colMap.hazards = currentHazards;
          
          // Fallback-Logik für Spaltenindizes basierend auf Beispielen: NET.2.2 | Name | CIA | G 0.x
          colMap.baustein = foundBausteinLabel !== -1 ? foundBausteinLabel : 0;
          colMap.mTitel = foundTitleLabel !== -1 ? foundTitleLabel : (foundBausteinLabel === 0 ? 1 : 1);
          colMap.mCode = foundCodeLabel !== -1 ? foundCodeLabel : colMap.baustein; // Oft identisch in der ID-Spalte
          
          break;
        }
      }

      if (headerRowIndex === -1) {
        continue; // Kein Kreuztabellen-Blatt
      }

      log += `Blatt "${sheetName}": Header in Zeile ${headerRowIndex + 1} gefunden. Spalten: B=${colMap.baustein}, T=${colMap.mTitel}, G-Anzahl=${colMap.hazards.length}\n`;
      processedSheets++;

      // Baustein-Vorgabe vom Header oder Blattnamen (z.B. "NET.2.2")
      const headerBausteinRaw = String(rows[headerRowIndex][colMap.baustein] || '').trim();
      const sheetBaustein = headerBausteinRaw.match(/^[A-Z]{2,4}\.[0-9.]+/) ? headerBausteinRaw.match(/^[A-Z]{2,4}\.[0-9.]+/)![0] : sheetName.split(' ')[0];

      // --- SCHRITT 2: Daten verarbeiten ---
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row)) continue;

        let baustein = String(row[colMap.baustein] || '').trim();
        let mCode = String(row[colMap.mCode] || '').trim();
        const mTitel = String(row[colMap.mTitel] || '').trim();

        // Wenn kein Code da ist, ist es keine Datenzeile
        if (!mCode && !baustein && !mTitel) continue;

        // Normalisierung: Wenn mCode den Baustein enthält (z.B. NET.2.2.M1)
        if (mCode.includes('.')) {
          const parts = mCode.split('.');
          if (parts.length > 1) {
            baustein = parts.slice(0, -1).join('.');
            mCode = parts[parts.length - 1];
          }
        }

        const cleanBaustein = baustein || sheetBaustein || 'GLOBAL';
        const cleanMCode = mCode || `M-${i}`;
        const measureId = `m-${cleanBaustein}-${cleanMCode}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        // Maßnahme speichern
        await saveCollectionRecord('hazardMeasures', measureId, {
          id: measureId,
          code: cleanMCode,
          title: mTitel || cleanMCode,
          baustein: cleanBaustein
        }, dataSource);
        totalMeasures++;

        // Relationen zu den G-Spalten
        for (const hCol of colMap.hazards) {
          const cellVal = String(row[hCol.index] || '').trim();
          
          // Boolean Presence: Nicht leer = Relation
          if (cellVal !== '') {
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
      const errorMsg = "Keine Kreuztabellen-Struktur (G 0.x Spalten) identifiziert. Bitte prüfen Sie das Format.";
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

    const successMsg = `Import erfolgreich: ${totalMeasures} Maßnahmen und ${totalRelations} Relationen aus ${processedSheets} Blättern verarbeitet.`;
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
    return { success: false, message: `Systemfehler: ${error.message}`, count: 0 };
  }
}
