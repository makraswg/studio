
'use server';

import { saveCollectionRecord, deleteCollectionRecord, getSingleRecord } from './mysql-actions';
import { Resource, DataSource } from '@/lib/types';
import { logAuditEventAction } from './audit-actions';

/**
 * Speichert oder aktualisiert eine IT-Ressource.
 */
export async function saveResourceAction(resource: Resource, dataSource: DataSource = 'mysql', actorEmail: string = 'system') {
  const isNew = !resource.id || resource.id === '';
  const id = isNew ? `res-${Math.random().toString(36).substring(2, 9)}` : resource.id;
  const now = new Date().toISOString();
  
  const data = {
    ...resource,
    id,
    createdAt: resource.createdAt || now,
    status: resource.status || 'active'
  };

  try {
    const res = await saveCollectionRecord('resources', id, data, dataSource);
    if (res.success) {
      await logAuditEventAction(dataSource as any, {
        tenantId: resource.tenantId,
        actorUid: actorEmail,
        action: isNew ? `Ressource registriert: ${resource.name}` : `Ressource aktualisiert: ${resource.name}`,
        entityType: 'resource',
        entityId: id,
        after: data
      });
    }
    return res;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Archiviert oder löscht eine Ressource.
 */
export async function deleteResourceAction(id: string, dataSource: DataSource = 'mysql', actorEmail: string = 'system') {
  try {
    const resData = await getSingleRecord('resources', id, dataSource);
    const res = await deleteCollectionRecord('resources', id, dataSource);
    
    if (res.success) {
      await logAuditEventAction(dataSource as any, {
        tenantId: resData.data?.tenantId || 'global',
        actorUid: actorEmail,
        action: `Ressource permanent gelöscht: ${resData.data?.name || id}`,
        entityType: 'resource',
        entityId: id,
        before: resData.data
      });
    }
    return res;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
