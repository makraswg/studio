
'use server';

import { saveCollectionRecord, getCollectionData } from './mysql-actions';
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
 */
function ensureUniqueId(requestedId: string, existingNodes: ProcessNode[]): string {
  let finalId = requestedId;
  let counter = 1;
  while (existingNodes.some(n => n.id === finalId)) {
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
    status: 'draft',
    ownerUserId,
    currentVersion: 1,
    createdAt: now,
    updatedAt: now
  };

  const initialModel: ProcessModel = {
    nodes: [{ id: 'start', type: 'start', title: 'START' }],
    edges: [],
    roles: [],
    isoFields: {}
  };

  const initialLayout: ProcessLayout = {
    positions: { 'start': { x: 100, y: 100 } }
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
  const versionsRes = await getCollectionData('process_versions', dataSource);
  const currentVersion = versionsRes.data?.find((v: ProcessVersion) => v.process_id === processId && v.version === version);

  if (!currentVersion) throw new Error("Prozessversion nicht gefunden.");
  
  let model = JSON.parse(JSON.stringify(currentVersion.model_json));
  let layout = JSON.parse(JSON.stringify(currentVersion.layout_json));

  // Operationen anwenden
  ops.forEach(op => {
    switch (op.type) {
      case 'ADD_NODE':
        if (!model.nodes) model.nodes = [];
        // DUPLICATE ID FIX: Sicherstellen, dass die ID eindeutig ist
        const uniqueId = ensureUniqueId(op.payload.node.id, model.nodes);
        const nodeToAdd = { ...op.payload.node, id: uniqueId };
        model.nodes.push(nodeToAdd);
        break;
      case 'UPDATE_NODE':
        model.nodes = model.nodes.map((n: any) => n.id === op.payload.nodeId ? { ...n, ...op.payload.patch } : n);
        break;
      case 'REMOVE_NODE':
        model.nodes = model.nodes.filter((n: any) => n.id !== op.payload.nodeId);
        if (model.edges) {
          model.edges = model.edges.filter((e: any) => e.source !== op.payload.nodeId && e.target !== op.payload.nodeId);
        }
        if (layout.positions) {
          delete layout.positions[op.payload.nodeId];
        }
        break;
      case 'ADD_EDGE':
        if (!model.edges) model.edges = [];
        model.edges.push(op.payload.edge);
        break;
      case 'REMOVE_EDGE':
        if (model.edges) {
          model.edges = model.edges.filter((e: any) => e.id !== op.payload.edgeId);
        }
        break;
      case 'UPDATE_LAYOUT':
        if (!layout.positions) layout.positions = {};
        layout.positions = { ...layout.positions, ...op.payload.positions };
        break;
      case 'SET_ISO_FIELD':
        if (!model.isoFields) model.isoFields = {};
        model.isoFields[op.payload.field] = op.payload.value;
        break;
      case 'REORDER_NODES':
        const { orderedNodeIds } = op.payload;
        if (Array.isArray(orderedNodeIds)) {
          const newNodes: ProcessNode[] = [];
          orderedNodeIds.forEach((id: string) => {
            const node = model.nodes.find((n: any) => n.id === id);
            if (node) newNodes.push(node);
          });
          model.nodes.forEach((n: any) => {
            if (!orderedNodeIds.includes(n.id)) newNodes.push(n);
          });
          model.nodes = newNodes;
        }
        break;
    }
  });

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
