'use server';

import { DataSource } from '@/lib/types';
import { saveCollectionRecord } from './mysql-actions';
import * as XLSX from 'xlsx';

export async function runBsiCrossTableImportAction(
  base64Content: string, 
  dataSource: DataSource = 'mysql'
): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const buffer = Buffer.from(base64Content, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data: any[] = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) throw new Error("Die Excel-Datei scheint leer zu sein.");

    let measureCount = 0;
    let relationCount = 0;

    // Wir suchen nach Spalten, die dem Muster G 0.x entsprechen
    // Wir normalisieren die Header, um Leerzeichen-Probleme zu vermeiden
    const headers = Object.keys(data[0]);
    const hazardColumns = headers.filter(h => {
      const clean = h.trim().toUpperCase().replace(/\s+/g, ' ');
      return /^G\s*0\.[0-9]+$/i.test(clean);
    });

    console.log(`Gefundene Gefährdungs-Spalten: ${hazardColumns.length}`);

    for (const row of data) {
      // Suche nach Baustein, ID und Titel (verschiedene Schreibweisen möglich)
      const baustein = row['Baustein'] || row['baustein'] || row['Element'];
      const mCode = row['Maßnahmen-ID'] || row['Massnahmen-ID'] || row['ID'] || row['id'];
      const mTitel = row['Maßnahmen-Titel'] || row['Massnahmen-Titel'] || row['Titel'] || row['titel'];

      if (!baustein || !mCode || !mTitel) continue;

      const measureId = `m-${baustein}-${mCode}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      
      // 1. Maßnahme anlegen
      await saveCollectionRecord('hazardMeasures', measureId, {
        id: measureId,
        code: mCode,
        title: mTitel,
        baustein: baustein
      }, dataSource);
      measureCount++;

      // 2. Relationen zu Gefährdungs-Spalten prüfen
      for (const col of hazardColumns) {
        const val = row[col];
        // Ein Kreuz liegt vor, wenn die Zelle nicht leer ist (X, x, 1, etc.)
        if (val !== undefined && val !== null && val.toString().trim() !== '') {
          const hazardCode = col.trim().toUpperCase().replace(/\s+/g, ' ');
          const relId = `rel-${measureId}-${hazardCode.replace(/[^a-z0-9]/gi, '_')}`.toLowerCase();
          
          await saveCollectionRecord('hazardMeasureRelations', relId, {
            id: relId,
            measureId: measureId,
            hazardCode: hazardCode
          }, dataSource);
          relationCount++;
        }
      }
    }

    return { 
      success: measureCount > 0, 
      message: measureCount > 0 
        ? `${measureCount} Maßnahmen und ${relationCount} Relationen erfolgreich importiert.`
        : `Keine Maßnahmen in der Excel-Datei gefunden. Prüfen Sie die Spaltenköpfe.`,
      count: measureCount
    };
  } catch (error: any) {
    console.error("Cross Table Import Error:", error);
    return { success: false, message: error.message, count: 0 };
  }
}
