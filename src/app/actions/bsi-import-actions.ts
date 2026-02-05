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

/**
 * Extrahiert rekursiv alle Textinhalte aus DocBook-Knoten (para, itemizedlist, etc.)
 */
function extractTextContent(node: any): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';

  let text = '';

  // Wenn es ein Array von Inhalten ist (z.B. mehrere Absätze)
  if (Array.isArray(node)) {
    return node.map(n => extractTextContent(n)).join('\n\n');
  }

  // Wenn es ein Objekt ist, schauen wir in die Schlüssel
  if (typeof node === 'object') {
    // In fast-xml-parser liegen Texte oft in #text
    if (node['#text']) text += node['#text'];
    
    // Verarbeite bekannte DocBook Tags in der richtigen Reihenfolge
    // Wir prüfen sowohl mit als auch ohne db: Präfix (da removeNSPrefix genutzt wird)
    const relevantKeys = ['para', 'formalpara', 'itemizedlist', 'orderedlist', 'table', 'listitem', 'simpara'];
    for (const key of relevantKeys) {
      if (node[key]) {
        text += '\n' + extractTextContent(node[key]);
      }
    }
  }

  return text.trim();
}

export interface BsiImportInput {
  catalogName: string;
  version: string;
  xmlContent: string;
}

/**
 * Verarbeitet BSI IT-Grundschutz DocBook 5 XML-Kataloge.
 */
export async function runBsiXmlImportAction(input: BsiImportInput, dataSource: DataSource = 'mysql'): Promise<{ success: boolean; runId: string; message: string }> {
  const runId = `run-${Math.random().toString(36).substring(2, 9)}`;
  const catalogId = `cat-${input.catalogName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${input.version.replace(/\./g, '_')}`;
  const now = new Date().toISOString();
  
  let itemCount = 0;
  let moduleCount = 0;
  let log = `DocBook 5 Import gestartet um ${now}\n`;

  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      removeNSPrefix: true, 
      trimValues: true,
      parseTagValue: true,
      alwaysCreateTextNode: false
    });
    
    const jsonObj = parser.parse(input.xmlContent);
    
    // Root-Element Suche (DocBook <book>, <article> oder <part>)
    const root = jsonObj.book || jsonObj.article || jsonObj.part || jsonObj.set;
    if (!root) {
      console.error("XML Root keys found:", Object.keys(jsonObj));
      throw new Error(`Kein DocBook Root-Element (book/article) gefunden. Gefundene Keys: ${Object.keys(jsonObj).join(', ')}`);
    }

    log += `DocBook Struktur erkannt. Katalog: ${input.catalogName}\n`;

    // 1. Katalog-Stammsatz anlegen
    const catalog: Catalog = {
      id: catalogId,
      name: input.catalogName,
      version: input.version,
      provider: 'BSI IT-Grundschutz (DocBook)',
      importedAt: now
    };
    await saveCollectionRecord('catalogs', catalogId, catalog, dataSource);

    // Kapitelerkennung (<chapter> oder <section> auf oberster Ebene)
    const chapters = [...ensureArray(root.chapter), ...ensureArray(root.section), ...ensureArray(root.part)];
    log += `${chapters.length} potenzielle Haupt-Kapitel gefunden.\n`;

    for (const chapter of chapters) {
      if (!chapter) continue;
      
      const chapterTitle = typeof chapter.title === 'string' ? chapter.title : extractTextContent(chapter.title);
      if (!chapterTitle) continue;

      // Wir suchen nach Kapiteln, die "Gefährdungen" im Titel haben
      const isHazardGroup = /Gefährdung/i.test(chapterTitle);
      
      if (!isHazardGroup) {
        log += `Überspringe Kapitel: "${chapterTitle.substring(0, 40)}..." (kein Gefährdungsbezug)\n`;
        continue;
      }

      log += `Verarbeite Gefährdungsgruppe: "${chapterTitle}"\n`;

      // Ableitung des Gruppen-Codes (G 0, G 1, etc.)
      let groupCode = 'G X';
      const codeMatch = chapterTitle.match(/G\s*([0-9]+)/i);
      if (codeMatch) groupCode = `G ${codeMatch[1]}`;

      const moduleId = `mod-${catalogId}-${chapter['@_xml:id'] || Math.random().toString(36).substring(2, 7)}`;
      const moduleRecord: HazardModule = {
        id: moduleId,
        catalogId: catalogId,
        code: groupCode,
        title: chapterTitle
      };
      await saveCollectionRecord('hazardModules', moduleId, moduleRecord, dataSource);
      moduleCount++;

      // Gefährdungen sind <section> innerhalb des Kapitels
      const sections = ensureArray(chapter.section);
      
      for (const section of sections) {
        if (!section) continue;
        const sectionTitle = typeof section.title === 'string' ? section.title : extractTextContent(section.title);
        
        // Erkennung einzelner Gefährdungen: "G <Gruppe>.<Nummer>"
        const hazardMatch = sectionTitle.match(/^(G\s*[0-9]+\.[0-9]+)[\s:]*(.*)$/);
        
        if (!hazardMatch) {
          continue;
        }

        const hazardCode = hazardMatch[1].replace(/\s+/g, ' '); 
        const hazardTitle = hazardMatch[2].trim() || hazardCode;
        const hazardId = `haz-${catalogId}-${section['@_xml:id'] || hazardCode.replace(/[^a-z0-9]/gi, '_')}`;

        // Beschreibung extrahieren
        const hazardDescription = extractTextContent(section);

        // Content-Hashing zur Dublettenprüfung
        const contentForHash = `${hazardTitle}|${hazardDescription}`;
        const hash = await generateHash(contentForHash);

        const hazardRecord: Hazard = {
          id: hazardId,
          moduleId: moduleId,
          code: hazardCode,
          title: hazardTitle,
          description: hazardDescription,
          contentHash: hash
        };

        await saveCollectionRecord('hazards', hazardId, hazardRecord, dataSource);
        itemCount++;
      }
    }

    if (itemCount === 0) {
      log += `WARNUNG: Keine Gefährdungen gefunden, die dem Muster "G x.y" entsprechen.\n`;
    } else {
      log += `Import erfolgreich. ${itemCount} Gefährdungen in ${moduleCount} Gruppen extrahiert.\n`;
    }
    
    const run: ImportRun = {
      id: runId,
      catalogId,
      timestamp: now,
      status: itemCount > 0 ? 'success' : 'partial',
      itemCount,
      log
    };
    await saveCollectionRecord('importRuns', runId, run, dataSource);

    return { 
      success: itemCount > 0, 
      runId, 
      message: itemCount > 0 
        ? `${itemCount} Gefährdungen erfolgreich importiert.` 
        : `Import abgeschlossen, aber 0 Einträge gefunden. Prüfen Sie das Protokoll.` 
    };

  } catch (error: any) {
    console.error("DocBook Import Error:", error);
    const errorRun: ImportRun = {
      id: runId,
      catalogId: 'unknown',
      timestamp: now,
      status: 'failed',
      itemCount: 0,
      log: log + `FEHLER: ${error.message}\n${error.stack}`
    };
    await saveCollectionRecord('importRuns', runId, errorRun, dataSource);
    return { success: false, runId, message: `Import Fehler: ${error.message}` };
  }
}
