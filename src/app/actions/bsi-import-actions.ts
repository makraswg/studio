'use server';

import { Catalog, HazardModule, Hazard, ImportRun, DataSource } from '@/lib/types';
import { saveCollectionRecord } from './mysql-actions';
import { XMLParser } from 'fast-xml-parser';
import { createHash } from 'node:crypto';

/**
 * Erzeugt einen SHA-256 Hash aus einem String zur Dublettenprüfung.
 */
async function generateHash(content: string): Promise<string> {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Stellt sicher, dass ein Wert immer ein Array ist.
 */
function ensureArray(val: any): any[] {
  if (val === undefined || val === null) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

export interface BsiImportInput {
  catalogName: string;
  version: string;
  xmlContent: string;
}

/**
 * Verarbeitet BSI IT-Grundschutz XML-Kataloge.
 */
export async function runBsiXmlImportAction(input: BsiImportInput, dataSource: DataSource = 'mysql'): Promise<{ success: boolean; runId: string; message: string }> {
  const runId = `run-${Math.random().toString(36).substring(2, 9)}`;
  const catalogId = `cat-${input.catalogName.toLowerCase().replace(/\s+/g, '-')}-${input.version.replace(/\./g, '_')}`;
  const now = new Date().toISOString();
  
  let itemCount = 0;
  let log = `XML Import gestartet um ${now}\n`;

  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      trimValues: true
    });
    
    const jsonObj = parser.parse(input.xmlContent);
    
    // Suche nach der Wurzel (BSI XML Struktur variiert je nach Edition)
    // Wir schauen in gängigen Wurzelknoten nach
    const root = jsonObj.grundschutz || 
                 jsonObj.kompendium || 
                 jsonObj.it_grundschutz || 
                 jsonObj['it-grundschutz'] || 
                 jsonObj;
    
    log += `Wurzelknoten identifiziert.\n`;

    // Extrahiere Bausteine/Module (verschiedene Pfade möglich)
    const rawModules = root.bausteine?.baustein || 
                       root.module?.modul || 
                       root.elemente?.element || 
                       root.baustein || 
                       root.modul || [];
    
    const modulesList = ensureArray(rawModules);
    log += `${modulesList.length} potenzielle Module gefunden.\n`;

    if (modulesList.length === 0) {
      throw new Error("Keine Module (Bausteine) im XML gefunden. Bitte Struktur prüfen.");
    }

    // 1. Katalog-Stammsatz anlegen
    const catalog: Catalog = {
      id: catalogId,
      name: input.catalogName,
      version: input.version,
      provider: 'BSI IT-Grundschutz',
      importedAt: now
    };
    await saveCollectionRecord('catalogs', catalogId, catalog, dataSource);

    for (const mod of modulesList) {
      const modCode = mod['@_code'] || mod.code || mod.id || 'UNKNOWN';
      const modTitle = mod.titel || mod.title || mod.name || mod['@_titel'] || modCode;
      const moduleId = `mod-${catalogId}-${modCode}`;

      const moduleRecord: HazardModule = {
        id: moduleId,
        catalogId: catalogId,
        code: String(modCode),
        title: String(modTitle)
      };
      await saveCollectionRecord('hazardModules', moduleId, moduleRecord, dataSource);

      // Gefährdungen extrahieren (Suche in verschiedenen Pfaden)
      const rawThreats = mod.gefaehrdungen?.gefaehrdung || 
                         mod.threats?.threat || 
                         mod.risiken?.risiko || 
                         mod.gefaehrdung || 
                         mod.threat || [];
      
      const threatsList = ensureArray(rawThreats);

      for (const threat of threatsList) {
        const threatCode = threat['@_code'] || threat.code || threat.id || `G_${Math.random().toString(36).substring(2,5)}`;
        const threatTitle = threat.titel || threat.title || threat.name || threat['@_titel'] || 'Unbenannt';
        const threatDesc = threat.beschreibung || threat.description || threat.text || threat.content || '';
        const threatId = `haz-${moduleId}-${threatCode}`;

        // Content-Hashing zur Dublettenprüfung
        const contentForHash = `${threatTitle}|${threatDesc}`;
        const hash = await generateHash(contentForHash);

        const hazardRecord: Hazard = {
          id: threatId,
          moduleId: moduleId,
          code: String(threatCode),
          title: String(threatTitle),
          description: String(threatDesc),
          contentHash: hash
        };

        await saveCollectionRecord('hazards', threatId, hazardRecord, dataSource);
        itemCount++;
      }
    }

    log += `Import erfolgreich abgeschlossen. ${itemCount} Gefährdungen verarbeitet.\n`;
    
    const run: ImportRun = {
      id: runId,
      catalogId,
      timestamp: now,
      status: 'success',
      itemCount,
      log
    };
    await saveCollectionRecord('importRuns', runId, run, dataSource);

    return { success: true, runId, message: `${itemCount} Einträge erfolgreich aus XML importiert.` };

  } catch (error: any) {
    console.error("BSI XML Import Error:", error);
    const errorRun: ImportRun = {
      id: runId,
      catalogId,
      timestamp: now,
      status: 'failed',
      itemCount: 0,
      log: log + `FEHLER: ${error.message}`
    };
    await saveCollectionRecord('importRuns', runId, errorRun, dataSource);
    return { success: false, runId, message: `Import Fehler: ${error.message}` };
  }
}
