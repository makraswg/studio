
'use server';

import { saveCollectionRecord, getCollectionData, deleteCollectionRecord } from './mysql-actions';
import { 
  Process, 
  ProcessVersion, 
  ProcessOperation, 
  ProcessModel, 
  ProcessLayout, 
  DataSource,
  ProcessNode
} from '@/lib/types';

/**
 * Hilfsfunktion zur Generierung einer eindeutigen ID innerhalb eines Modells.
 * Verhindert den "Duplicate ID" Fehler für Knoten und Verbindungen.
 */
function ensureUniqueId(requestedId: string, usedIds: Set<string>): string {
  let finalId = requestedId;
  let counter = 1;
  while (usedIds.has(finalId)) {
    finalId = `${requestedId}-${counter}`;
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
  ownerUserId: string,
  dataSource: DataSource = 'mysql'
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
    ownerUserId,
    currentVersion: 1,
    createdAt: now,
    updatedAt: now
  };

  const initialModel: ProcessModel = {
    nodes: [{ id: 'start', type: 'start', title: 'Start' }],
    edges: [],
    roles: [],
    isoFields: {}
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
    created_by_user_id: ownerUserId,
    created_at: now
  };

  const res1 = await saveCollectionRecord('processes', processId, process, dataSource);
  if (!res1.success) throw new Error(`Fehler beim Speichern des Prozesses: ${res1.error}`);

  const res2 = await saveCollectionRecord('process_versions', version.id, version, dataSource);
  if (!res2.success) throw new Error(`Fehler beim Speichern der Prozessversion: ${res2.error}`);

  return { success: true, processId };
}

/**
 * Löscht einen Prozess und alle zugehörigen Versionen.
 */
export async function deleteProcessAction(processId: string, dataSource: DataSource = 'mysql') {
  try {
    // 1. Versionen löschen
    const verRes = await getCollectionData('process_versions', dataSource);
    const versions = verRes.data?.filter((v: any) => v.process_id === processId) || [];
    for (const v of versions) {
      await deleteCollectionRecord('process_versions', v.id, dataSource);
    }

    // 2. Prozess löschen
    await deleteCollectionRecord('processes', processId, dataSource);
    
    return { success: true };
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
  const res = await getCollectionData('processes', dataSource);
  const process = res.data?.find((p: Process) => p.id === processId);
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
 * Inklusive intelligenter Konfliktlösung für IDs (Duplicate ID Fix).
 */
export async function applyProcessOpsAction(
  processId: string,
  version: number,
  ops: ProcessOperation[],
  expectedRevision: number,
  userId: string,
  dataSource: DataSource = 'mysql'
) {
  const versionsRes = await getCollectionData('process_versions', dataSource);
  const currentVersion = versionsRes.data?.find((v: ProcessVersion) => v.process_id === processId && v.version === version);

  if (!currentVersion) throw new Error("Prozessversion nicht gefunden.");
  
  let model = JSON.parse(JSON.stringify(currentVersion.model_json));
  let layout = JSON.parse(JSON.stringify(currentVersion.layout_json));

  // Sicherheitsnetz für IDs
  const usedNodeIds = new Set((model.nodes || []).map((n: any) => n.id));
  const usedEdgeIds = new Set((model.edges || []).map((e: any) => e.id));
  
  const nodeIdMap: Record<string, string> = {};
  const edgeIdMap: Record<string, string> = {};

  // 1. Pass: Eindeutigkeit prüfen und Mapping für Knoten und Edges erstellen
  ops.forEach(op => {
    if (op.type === 'ADD_NODE' && op.payload?.node) {
      const originalId = op.payload.node.id;
      const uniqueId = ensureUniqueId(originalId, usedNodeIds);
      usedNodeIds.add(uniqueId);
      if (uniqueId !== originalId) {
        nodeIdMap[originalId] = uniqueId;
      }
    }
    if (op.type === 'ADD_EDGE' && op.payload?.edge) {
      const originalId = op.payload.edge.id;
      const uniqueId = ensureUniqueId(originalId, usedEdgeIds);
      usedEdgeIds.add(uniqueId);
      if (uniqueId !== originalId) {
        edgeIdMap[originalId] = uniqueId;
      }
    }
  });

  // 2. Pass: Operationen anwenden mit korrigierten IDs (Remapping)
  for (const op of ops) {
    switch (op.type) {
      case 'ADD_NODE':
        if (!model.nodes) model.nodes = [];
        if (!op.payload?.node) break;
        
        const reqId = op.payload.node.id;
        const finalId = nodeIdMap[reqId] || reqId;
        
        const nodeToAdd = { ...op.payload.node, id: finalId };
        model.nodes.push(nodeToAdd);
        
        if (!layout.positions[finalId]) {
          const lastX = model.nodes.length > 1 
            ? Math.max(...Object.values(layout.positions).map((p: any) => (p as any).x)) 
            : 50;
          layout.positions[finalId] = { x: lastX + 220, y: 150 };
        }
        break;

      case 'UPDATE_NODE':
        if (!op.payload?.nodeId) break;
        const targetUpdId = nodeIdMap[op.payload.nodeId] || op.payload.nodeId;
        model.nodes = model.nodes.map((n: any) => n.id === targetUpdId ? { ...n, ...op.payload.patch } : n);
        break;

      case 'REMOVE_NODE':
        if (!op.payload?.nodeId) break;
        const targetRemId = nodeIdMap[op.payload.nodeId] || op.payload.nodeId;
        model.nodes = model.nodes.filter((n: any) => n.id !== targetRemId);
        if (model.edges) {
          model.edges = model.edges.filter((e: any) => e.source !== targetRemId && e.target !== targetRemId);
        }
        if (layout.positions) {
          delete layout.positions[targetRemId];
        }
        break;

      case 'ADD_EDGE':
        if (!model.edges) model.edges = [];
        if (!op.payload?.edge) break;
        
        const reqEId = op.payload.edge.id;
        const finalEId = edgeIdMap[reqEId] || reqEId;
        
        const edge = { ...op.payload.edge, id: finalEId };
        // Referenzen korrigieren, falls Quelle/Ziel umgemappt wurden
        edge.source = nodeIdMap[edge.source] || edge.source;
        edge.target = nodeIdMap[edge.target] || edge.target;
        
        model.edges.push(edge);
        break;

      case 'REMOVE_EDGE':
        if (!op.payload?.edgeId) break;
        const targetRemEId = edgeIdMap[op.payload.edgeId] || op.payload.edgeId;
        if (model.edges) {
          model.edges = model.edges.filter((e: any) => e.id !== targetRemEId);
        }
        break;

      case 'UPDATE_LAYOUT':
        if (!layout.positions) layout.positions = {};
        if (!op.payload?.positions) break;
        
        const newPos: Record<string, any> = {};
        Object.entries(op.payload.positions).forEach(([id, pos]) => {
          newPos[nodeIdMap[id] || id] = pos;
        });
        
        layout.positions = { ...layout.positions, ...newPos };
        break;

      case 'SET_ISO_FIELD':
        if (!model.isoFields) model.isoFields = {};
        if (op.payload?.field) {
          model.isoFields[op.payload.field] = op.payload.value;
        }
        break;

      case 'REORDER_NODES':
        const { orderedNodeIds } = op.payload || {};
        if (Array.isArray(orderedNodeIds)) {
          const mappedOrderedIds = orderedNodeIds.map((id: string) => nodeIdMap[id] || id);
          const newNodes: ProcessNode[] = [];
          mappedOrderedIds.forEach((id: string) => {
            const node = model.nodes.find((n: any) => n.id === id);
            if (node) newNodes.push(node);
          });
          // Fallback für nicht gelistete Knoten
          model.nodes.forEach((n: any) => {
            if (!mappedOrderedIds.includes(n.id)) newNodes.push(n);
          });
          model.nodes = newNodes;
        }
        break;

      case 'UPDATE_PROCESS_META':
        if (op.payload) {
          await updateProcessMetadataAction(processId, op.payload, dataSource);
        }
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
  if (!res.success) throw new Error("Update der Version fehlgeschlagen.");

  return { success: true, revision: nextRevision };
}
