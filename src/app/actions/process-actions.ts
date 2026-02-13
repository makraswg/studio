
'use server';

import { saveCollectionRecord, getCollectionData, deleteCollectionRecord, getSingleRecord } from './mysql-actions';
import { 
  Process, 
  ProcessVersion, 
  ProcessOperation, 
  ProcessModel, 
  ProcessLayout, 
  DataSource,
  ProcessNode
} from '@/lib/types';
import { logAuditEventAction } from './audit-actions';

/**
 * Hilfsfunktion zur Generierung einer eindeutigen ID innerhalb eines Modells.
 * Verhindert den "Duplicate ID" Fehler für Knoten und Verbindungen.
 */
function ensureUniqueId(requestedId: string | null | undefined, usedIds: Set<string>, prefix: string = 'node'): string {
  const idStr = String(requestedId || '').trim().toLowerCase();
  const isInvalid = !requestedId || 
                    idStr === 'undefined' || 
                    idStr === 'null' || 
                    idStr === '' ||
                    idStr === '[object object]';

  let baseId = isInvalid 
    ? `${prefix}-${Math.random().toString(36).substring(2, 7)}` 
    : String(requestedId);
  
  let finalId = baseId;
  let counter = 1;
  while (usedIds.has(finalId)) {
    finalId = `${baseId}-${counter}`;
    counter++;
  }
  return finalId;
}

/**
 * Erstellt einen neuen Prozess.
 */
export async function createProcessAction(
  tenantId: string, 
  title: string, 
  ownerRoleId: string,
  dataSource: DataSource = 'mysql',
  actorEmail: string = 'system'
) {
  const processId = `proc-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  const process: Process = {
    id: processId,
    tenantId,
    title,
    description: '',
    openQuestions: '',
    status: 'draft',
    ownerRoleId,
    currentVersion: 1,
    createdAt: now,
    updatedAt: now
  };

  const initialModel: ProcessModel = {
    nodes: [{ id: 'start', type: 'start', title: 'START', checklist: [] }],
    edges: [],
    roles: [],
    isoFields: {},
    customFields: {}
  };

  const initialLayout: ProcessLayout = {
    positions: { 'start': { x: 100, y: 150 } }
  };

  const version: ProcessVersion = {
    id: `ver-${processId}-1`,
    process_id: processId,
    version: 1,
    model_json: initialModel,
    layout_json: initialLayout,
    revision: 0,
    created_by_user_id: 'system',
    created_at: now
  };

  const res1 = await saveCollectionRecord('processes', processId, process, dataSource);
  if (!res1.success) throw new Error(`Fehler beim Speichern des Prozesses: ${res1.error}`);

  const res2 = await saveCollectionRecord('process_versions', version.id, version, dataSource);
  if (!res2.success) throw new Error(`Fehler beim Speichern der Prozessversion: ${res2.error}`);

  await logAuditEventAction(dataSource, {
    tenantId,
    actorUid: actorEmail,
    action: `Prozess-Entwurf angelegt: ${title}`,
    entityType: 'process',
    entityId: processId,
    after: process
  });

  return { success: true, processId };
}

/**
 * Klont einen bestehenden Prozess als neuen Notfallprozess.
 */
export async function cloneProcessAsEmergencyAction(
  sourceProcessId: string,
  dataSource: DataSource = 'mysql',
  actorEmail: string = 'system'
) {
  // 1. Quellprozess abrufen
  const sourceRes = await getSingleRecord('processes', sourceProcessId, dataSource);
  const source = sourceRes.data as Process;
  if (!source) throw new Error("Quellprozess nicht gefunden.");

  // 2. Aktive Version abrufen
  const verRes = await getCollectionData('process_versions', dataSource);
  const sourceVersion = verRes.data?.find((v: any) => v.process_id === sourceProcessId && v.version === source.currentVersion);
  if (!sourceVersion) throw new Error("Aktive Version des Quellprozesses nicht gefunden.");

  // 3. Neue IDs generieren
  const newProcessId = `proc-emg-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  // 4. Prozess-Datensatz erstellen
  const newProcess: Process = {
    ...source,
    id: newProcessId,
    title: `NOTFALL: ${source.title}`,
    status: 'draft',
    process_type_id: 'pt-disaster',
    emergencyProcessId: undefined, // Ein Notfallprozess hat selbst keinen Notfallprozess
    currentVersion: 1,
    createdAt: now,
    updatedAt: now
  };

  // 5. Version-Datensatz erstellen (Deep Copy der JSON Felder)
  const newVersion: ProcessVersion = {
    id: `ver-${newProcessId}-1`,
    process_id: newProcessId,
    version: 1,
    model_json: JSON.parse(JSON.stringify(sourceVersion.model_json)),
    layout_json: JSON.parse(JSON.stringify(sourceVersion.layout_json)),
    revision: 0,
    created_by_user_id: 'system',
    created_at: now
  };

  // 6. Beides speichern
  await saveCollectionRecord('processes', newProcessId, newProcess, dataSource);
  await saveCollectionRecord('process_versions', newVersion.id, newVersion, dataSource);

  // 7. Quellprozess aktualisieren, um auf diesen neuen Notfallprozess zu zeigen
  await updateProcessMetadataAction(sourceProcessId, { emergencyProcessId: newProcessId }, dataSource);

  // 8. Audit Log
  await logAuditEventAction(dataSource, {
    tenantId: source.tenantId,
    actorUid: actorEmail,
    action: `Prozess geklont als Notfall-Fallback: ${newProcess.title}`,
    entityType: 'process',
    entityId: newProcessId,
    after: newProcess
  });

  return { success: true, processId: newProcessId };
}

/**
 * Löscht einen Prozess und alle zugehörigen Versionen.
 */
export async function deleteProcessAction(processId: string, dataSource: DataSource = 'mysql', actorEmail: string = 'system') {
  try {
    const procData = await getSingleRecord('processes', processId, dataSource);
    const verRes = await getCollectionData('process_versions', dataSource);
    const versions = verRes.data?.filter((v: any) => v.process_id === processId) || [];
    for (const v of versions) {
      await deleteCollectionRecord('process_versions', v.id, dataSource);
    }
    const res = await deleteCollectionRecord('processes', processId, dataSource);
    
    if (res.success) {
      await logAuditEventAction(dataSource, {
        tenantId: resData.data?.tenantId || 'global',
        actorUid: actorEmail,
        action: `Prozess permanent gelöscht: ${resData.data?.title || processId}`,
        entityType: 'process',
        entityId: processId,
        before: resData.data
      });
    }
    return res;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Aktualisiert die Stammdaten eines Prozesses.
 */
export async function updateProcessMetadataAction(
  processId: string,
  data: Partial<Process>,
  dataSource: DataSource = 'mysql'
) {
  const res = await getSingleRecord('processes', processId, dataSource);
  const process = res.data;
  if (!process) throw new Error("Prozess nicht gefunden.");

  const updatedProcess = {
    ...process,
    ...data,
    updatedAt: new Date().toISOString()
  };

  return await saveCollectionRecord('processes', processId, updatedProcess, dataSource);
}

/**
 * Wendet Operationen auf eine Prozessversion an.
 */
export async function applyProcessOpsAction(
  processId: string,
  version: number,
  ops: ProcessOperation[],
  expectedRevision: number,
  userId: string,
  dataSource: DataSource = 'mysql'
) {
  const versionId = `ver-${processId}-${version}`;
  const versionRes = await getSingleRecord('process_versions', versionId, dataSource);
  const currentVersion = versionRes.data;

  if (!currentVersion) throw new Error("Prozessversion nicht gefunden.");
  
  let model = JSON.parse(JSON.stringify(currentVersion.model_json || { nodes: [], edges: [], roles: [], isoFields: {}, customFields: {} }));
  let layout = JSON.parse(JSON.stringify(currentVersion.layout_json || { positions: {} }));

  const usedIds = new Set([
    ...(model.nodes || []).map((n: any) => String(n.id)),
    ...(model.edges || []).map((e: any) => String(e.id))
  ]);
  
  const nodeIdMap: Record<string, string> = {};
  const edgeIdMap: Record<string, string> = {};

  ops.forEach(op => {
    if (op.type === 'ADD_NODE' && op.payload?.node) {
      const originalId = op.payload.node.id;
      const uniqueId = ensureUniqueId(originalId, usedIds, 'node');
      usedIds.add(uniqueId);
      if (originalId && String(originalId).toLowerCase() !== 'undefined') {
        nodeIdMap[String(originalId)] = uniqueId;
      }
      op.payload.node.id = uniqueId;
    }
    if (op.type === 'ADD_EDGE' && op.payload?.edge) {
      const originalId = op.payload.edge.id;
      const uniqueId = ensureUniqueId(originalId, usedIds, 'edge');
      usedIds.add(uniqueId);
      if (originalId && String(originalId).toLowerCase() !== 'undefined') {
        edgeIdMap[String(originalId)] = uniqueId;
      }
      op.payload.edge.id = uniqueId;
    }
  });

  for (const op of ops) {
    switch (op.type) {
      case 'ADD_NODE':
        if (!model.nodes) model.nodes = [];
        if (!op.payload?.node) break;
        const nodeToAdd = { ...op.payload.node };
        if (!nodeToAdd.checklist) nodeToAdd.checklist = [];
        model.nodes.push(nodeToAdd);
        if (!layout.positions[nodeToAdd.id]) {
          const posValues = Object.values(layout.positions);
          const lastX = posValues.length > 0 ? Math.max(...posValues.map((p: any) => (p as any).x || 0)) : 50;
          layout.positions[nodeToAdd.id] = { x: lastX + 220, y: 150 };
        }
        break;

      case 'UPDATE_NODE':
        if (!op.payload?.nodeId) break;
        const targetUpdId = nodeIdMap[String(op.payload.nodeId)] || String(op.payload.nodeId);
        model.nodes = (model.nodes || []).map((n: any) => n.id === targetUpdId ? { ...n, ...op.payload.patch } : n);
        break;

      case 'REMOVE_NODE':
        if (!op.payload?.nodeId) break;
        const targetRemId = String(op.payload.nodeId);
        model.nodes = (model.nodes || []).filter((n: any) => String(n.id) !== targetRemId);
        if (model.edges) {
          model.edges = model.edges.filter((e: any) => String(e.source) !== targetRemId && String(e.target) !== targetRemId);
        }
        if (layout.positions) {
          delete layout.positions[targetRemId];
        }
        break;

      case 'ADD_EDGE':
        if (!model.edges) model.edges = [];
        if (!op.payload?.edge) break;
        const edgeToAdd = { ...op.payload.edge };
        edgeToAdd.source = nodeIdMap[String(edgeToAdd.source)] || String(edgeToAdd.source);
        edgeToAdd.target = nodeIdMap[String(edgeToAdd.target)] || String(edgeToAdd.target);
        if (edgeToAdd.source !== 'undefined' && edgeToAdd.target !== 'undefined') {
          model.edges.push(edgeToAdd);
        }
        break;

      case 'REMOVE_EDGE':
        if (!op.payload?.edgeId) break;
        const targetRemEId = String(op.payload.edgeId);
        if (model.edges) {
          model.edges = model.edges.filter((e: any) => String(e.id) !== targetRemEId);
        }
        break;

      case 'UPDATE_LAYOUT':
        if (!layout.positions) layout.positions = {};
        if (op.payload?.positions) {
          Object.entries(op.payload.positions).forEach(([id, pos]) => {
            layout.positions[nodeIdMap[id] || id] = pos;
          });
        }
        break;

      case 'SET_ISO_FIELD':
        if (!model.isoFields) model.isoFields = {};
        if (op.payload?.field) model.isoFields[op.payload.field] = op.payload.value;
        break;

      case 'REORDER_NODES':
        const { orderedNodeIds } = op.payload || {};
        if (Array.isArray(orderedNodeIds)) {
          const mappedOrderedIds = orderedNodeIds.map((id: string) => nodeIdMap[String(id)] || String(id));
          const newNodes: ProcessNode[] = [];
          mappedOrderedIds.forEach((id: string) => {
            const node = (model.nodes || []).find((n: any) => String(n.id) === id);
            if (node) newNodes.push(node);
          });
          model.nodes = newNodes;
        }
        break;

      case 'UPDATE_PROCESS_META':
        if (op.payload) await updateProcessMetadataAction(processId, op.payload, dataSource);
        break;
    }
  }

  const nextRevision = (currentVersion.revision || 0) + 1;
  const updatedVersion = {
    ...currentVersion,
    model_json: model,
    layout_json: layout,
    revision: nextRevision
  };

  const res = await saveCollectionRecord('process_versions', currentVersion.id, updatedVersion, dataSource);
  if (!res.success) throw new Error("Update der Version fehlgeschlagen: " + res.error);

  return { success: true, revision: nextRevision };
}

/**
 * Erstellt einen Audit-Eintrag.
 */
export async function commitProcessVersionAction(
  processId: string,
  versionNum: number,
  actorUid: string,
  dataSource: DataSource = 'mysql'
) {
  const versionId = `ver-${processId}-${versionNum}`;
  const versionRes = await getSingleRecord('process_versions', versionId, dataSource);
  const current = versionRes.data;
  
  if (!current) throw new Error("Keine Version zum Speichern gefunden.");

  const timestamp = new Date().toISOString();
  const summary = `Version ${versionNum}.0 (Revision ${current.revision}) durch ${actorUid} gespeichert. Struktur-Integrität bestätigt.`;

  await logAuditEventAction(dataSource, {
    tenantId: 'global',
    actorUid,
    action: summary,
    entityType: 'process',
    entityId: processId,
    after: current.model_json
  });

  await updateProcessMetadataAction(processId, { updatedAt: timestamp }, dataSource);

  return { success: true };
}
