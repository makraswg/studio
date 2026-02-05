
'use server';

import { DataSource, ImportRun } from '@/lib/types';
import { saveCollectionRecord } from './mysql-actions';
import * as XLSX from 'xlsx';

/**
 * Importiert Maßnahmen und deren Relationen zu Gefährdungen aus der BSI Kreuztabelle (Excel).
 * Nutzt deterministische IDs, um Dubletten bei Mehrfach-Importen zu verhindern.
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
    let processedSheetsCount = 0;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (rows.length < 2) continue;

      let headerRowIndex = -1;
      let bausteinCode = '';
      let titleColIdx = -1;
      const hazardCols: { code: string, index: number }[] = [];

      // Suche nach der Kopfzeile (identifiziert durch G 0.x Muster)
      for (let i = 0; i < Math.min(rows.length, 50); i++) {
        const row = rows[i];
        let foundG = false;
        
        row.forEach((cell, idx) => {
          const val = String(cell || '').trim();
          
          // Baustein-Code Erkennung (z.B. NET.2.2) in der ersten Spalte
          if (idx === 0 && /^[A-Z]{2,4}\.[0-9.]+$/.test(val)) {
            bausteinCode = val;
          }

          // Gefährdungs-Spalten (G 0.1 etc)
          const gMatch = val.match(/^G\s*0\.([0-9]+)/i);
          if (gMatch) {
            hazardCols.push({ code: `G 0.${gMatch[1]}`, index: idx });
            foundG = true;
          }

          // Titel Spalte
          if (/^(Name|Titel|Bezeichnung)$/i.test(val)) {
            titleColIdx = idx;
          }
        });

        if (foundG) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1 || !bausteinCode) continue;

      log += `Blatt "${sheetName}": Baustein ${bausteinCode} erkannt. Verarbeite Zeilen...\n`;
      processedSheetsCount++;

      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        const mCode = String(row[0] || '').trim();
        const mTitel = titleColIdx !== -1 ? String(row[titleColIdx] || '').trim() : '';

        if (!mCode) continue;

        // Deterministische ID für die Maßnahme: m-{baustein}-{code}
        const measureId = `m-${bausteinCode}-${mCode}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        await saveCollectionRecord('hazardMeasures', measureId, {
          id: measureId,
          code: mCode,
          title: mTitel || mCode,
          baustein: bausteinCode
        }, dataSource);
        totalMeasures++;

        // Relationen verarbeiten
        for (const hCol of hazardCols) {
          const cellVal = String(row[hCol.index] || '').trim();
          if (cellVal !== '') {
            // Deterministische ID für die Relation
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

    if (processedSheetsCount === 0) {
      throw new Error("Keine Kreuztabellen-Blätter identifiziert. Bitte prüfen Sie die Spaltenköpfe (z.B. 'NET.2.2', 'Name', 'G 0.1').");
    }

    const successMsg = `Import abgeschlossen: ${totalMeasures} Maßnahmen und ${totalRelations} Relationen aus ${processedSheetsCount} Blättern identifiziert.`;
    await saveCollectionRecord('importRuns', runId, {
      id: runId,
      catalogId: 'bsi-krt-2023',
      timestamp: now,
      status: 'success',
      itemCount: totalMeasures,
      log: log + `ERFOLG: ${successMsg}`
    }, dataSource);

    return { success: true, message: successMsg, count: totalMeasures };
  } catch (error: any) {
    console.error("Excel Import Error:", error);
    return { success: false, message: error.message, count: 0 };
  }
}
