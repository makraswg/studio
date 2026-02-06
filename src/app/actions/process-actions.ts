
'use server';

import { saveCollectionRecord, getCollectionData, deleteCollectionRecord } from './mysql-actions';
import { 
  Process, 
  ProcessVersion, 
  ProcessOperation, 
  ProcessModel, 
  ProcessLayout, 
  DataSource 
} from '@/lib/types';
import { logAuditEventAction } from './audit-actions';

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
    nodes: [{ id: 'start', type: 'start', title: 'Start' }],
    edges: [],
    roles: []
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
  if (currentVersion.revision !== expectedRevision) {
    return { success: false, conflict: true, currentRevision: currentVersion.revision };
  }

  let model = { ...currentVersion.model_json };
  let layout = { ...currentVersion.layout_json };

  // Operationen anwenden
  ops.forEach(op => {
    switch (op.type) {
      case 'ADD_NODE':
        if (!model.nodes) model.nodes = [];
        model.nodes.push(op.payload.node);
        break;
      case 'UPDATE_NODE':
        model.nodes = model.nodes.map(n => n.id === op.payload.nodeId ? { ...n, ...op.payload.patch } : n);
        break;
      case 'REMOVE_NODE':
        model.nodes = model.nodes.filter(n => n.id !== op.payload.nodeId);
        if (model.edges) {
          model.edges = model.edges.filter(e => e.source !== op.payload.nodeId && e.target !== op.payload.nodeId);
        }
        break;
      case 'ADD_EDGE':
        if (!model.edges) model.edges = [];
        model.edges.push(op.payload.edge);
        break;
      case 'UPDATE_LAYOUT':
        if (!layout.positions) layout.positions = {};
        layout.positions = { ...layout.positions, ...op.payload.positions };
        break;
    }
  });

  const nextRevision = currentVersion.revision + 1;
  const updatedVersion = {
    ...currentVersion,
    model_json: model,
    layout_json: layout,
    revision: nextRevision
  };

  const opRecord = {
    id: `op-${Math.random().toString(36).substring(2, 9)}`,
    process_id: processId,
    version,
    revision_before: currentVersion.revision,
    revision_after: nextRevision,
    actor_type: 'user',
    actor_user_id: userId,
    ops_json: ops,
    created_at: new Date().toISOString()
  };

  const res1 = await saveCollectionRecord('process_versions', currentVersion.id, updatedVersion, dataSource);
  if (!res1.success) throw new Error("Update der Version fehlgeschlagen.");

  await saveCollectionRecord('process_ops', opRecord.id, opRecord, dataSource);

  return { success: true, revision: nextRevision };
}
