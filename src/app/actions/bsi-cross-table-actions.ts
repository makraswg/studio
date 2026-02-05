'use server';

import { DataSource } from '@/lib/types';
import { saveCollectionRecord } from './mysql-actions';
import * as XLSX from 'xlsx';

/**
 * Importiert Maßnahmen und deren Relationen zu Gefährdungen aus der BSI Kreuztabelle (Excel).
 * Folgt strikt der Anleitung: Verarbeitet nur Blätter mit G 0.x Spalten, identifiziert
 * Maßnahmen über Baustein + Code und bilde Relationen basierend auf Zellenpräsenz.
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

    // Wir durchlaufen ALLE Tabellenblätter
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length === 0) continue;

      // --- SCHRITT 1: Blatt klassifizieren (Header-Suche) ---
      let headerRowIndex = -1;
      let colMap = {
        baustein: -1,
        mCode: -1,
        mTitel: -1,
        hazards: [] as { code: string, index: number }[]
      };

      // Wir scannen die ersten 30 Zeilen nach der Kopfzeile
      for (let i = 0; i < Math.min(rows.length, 30); i++) {
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
          
          // Identifiziere Spalten für Maßnahmen-Metadaten
          if (val.includes('BAUSTEIN') || val === 'ELEMENT') currentMap.baustein = idx;
          if (val.includes('ID') || val.includes('CODE') || val === 'NR.' || val.includes('MASSNAHMEN-NR')) currentMap.mCode = idx;
          if (val.includes('TITEL') || val.includes('BEZEICHNUNG') || (val.includes('MASSNAHME') && !val.includes('NR'))) {
            if (currentMap.mTitel === -1) currentMap.mTitel = idx;
          }

          // Identifiziere Gefährdungs-Spalten (G 0.x)
          const gMatch = val.replace(/\s+/g, ' ').match(/G\s*0\.([0-9]+)/i);
          if (gMatch) {
            currentMap.hazards.push({ 
              code: `G 0.${gMatch[1]}`, 
              index: idx 
            });
          }
        });

        // Ein Blatt ist relevant, wenn es mindestens eine Gefährdungsspalte hat
        if (currentMap.hazards.length >= 1) {
          headerRowIndex = i;
          colMap = currentMap;
          break;
        }
      }

      // Wenn kein Header gefunden wurde -> Blatt ignorieren (z.B. Legende)
      if (headerRowIndex === -1) continue;

      processedSheets++;

      // --- SCHRITT 2 & 3: Zeilenweise Verarbeitung ab der Datenzeile ---
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;

        const baustein = String(row[colMap.baustein] || '').trim();
        const mCode = String(row[colMap.mCode] || '').trim();
        const mTitel = String(row[colMap.mTitel] || '').trim();

        // Validierung: Ohne Code oder Baustein keine Identifikation möglich
        if (!mCode && !baustein) continue;

        // Technischer Schlüssel: Baustein + Code (normalisiert)
        const measureId = `m-${baustein || 'global'}-${mCode}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        // Maßnahme anlegen/aktualisieren
        await saveCollectionRecord('hazardMeasures', measureId, {
          id: measureId,
          code: mCode || 'N/A',
          title: mTitel || mCode || 'Unbenannte Maßnahme',
          baustein: baustein || 'Allgemein'
        }, dataSource);
        totalMeasures++;

        // Relationen prüfen für jede Gefährdungsspalte
        for (const hCol of colMap.hazards) {
          const val = row[hCol.index];
          
          // Boolean-Logik: Zelle nicht leer (und nicht nur Leerzeichen) -> Relation existiert
          if (val !== undefined && val !== null && String(val).trim() !== '') {
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
      throw new Error("Keine Blätter mit Kreuztabellen-Struktur (Spalten G 0.x) in der Datei gefunden.");
    }

    return { 
      success: true, 
      message: `Import abgeschlossen: ${totalMeasures} Maßnahmen und ${totalRelations} Relationen aus ${processedSheets} Blättern identifiziert.`,
      count: totalMeasures
    };
  } catch (error: any) {
    console.error("Excel Cross Table Import Error:", error);
    return { success: false, message: error.message, count: 0 };
  }
}
