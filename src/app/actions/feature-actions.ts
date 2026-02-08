
'use server';

import { saveCollectionRecord, getCollectionData, deleteCollectionRecord } from './mysql-actions';
import { Feature, FeatureLink, FeatureDependency, DataSource } from '@/lib/types';
import { logAuditEventAction } from './audit-actions';

/**
 * Speichert oder aktualisiert ein Merkmal.
 */
export async function saveFeatureAction(feature: Feature, dataSource: DataSource = 'mysql', actorEmail: string = 'system') {
  const isNew = !feature.id || feature.id === '';
  const id = isNew ? `feat-${Math.random().toString(36).substring(2, 9)}` : feature.id;
  const now = new Date().toISOString();
  
  const data = {
    ...feature,
    id,
    createdAt: feature.createdAt || now,
    updatedAt: now
  };

  try {
    const res = await saveCollectionRecord('features', id, data, dataSource);
    if (res.success) {
      await logAuditEventAction(dataSource as any, {
        tenantId: feature.tenantId,
        actorUid: actorEmail,
        action: isNew ? `Merkmal angelegt: ${feature.name}` : `Merkmal aktualisiert: ${feature.name}`,
        entityType: 'feature',
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
 * Löscht ein Merkmal und alle Verknüpfungen.
 */
export async function deleteFeatureAction(featureId: string, dataSource: DataSource = 'mysql') {
  try {
    // Verknüpfungen und Abhängigkeiten müssten hier ebenfalls bereinigt werden
    const linksRes = await getCollectionData('feature_links', dataSource);
    const links = linksRes.data?.filter(l => l.featureId === featureId) || [];
    for (const link of links) {
      await deleteCollectionRecord('feature_links', link.id, dataSource);
    }

    const depsRes = await getCollectionData('feature_dependencies', dataSource);
    const deps = depsRes.data?.filter(d => d.featureId === featureId || d.dependentFeatureId === featureId) || [];
    for (const dep of deps) {
      await deleteCollectionRecord('feature_dependencies', dep.id, dataSource);
    }

    return await deleteCollectionRecord('features', featureId, dataSource);
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Verknüpft ein Merkmal mit einem anderen Objekt (Prozess, Ressource, Risiko).
 */
export async function linkFeatureAction(link: Omit<FeatureLink, 'id'>, dataSource: DataSource = 'mysql') {
  const id = `flnk-${Math.random().toString(36).substring(2, 9)}`;
  return await saveCollectionRecord('feature_links', id, { ...link, id }, dataSource);
}

/**
 * Entfernt eine Verknüpfung.
 */
export async function unlinkFeatureAction(linkId: string, dataSource: DataSource = 'mysql') {
  return await deleteCollectionRecord('feature_links', linkId, dataSource);
}

/**
 * Fügt eine Abhängigkeit zwischen zwei Merkmalen hinzu.
 */
export async function addFeatureDependencyAction(dep: Omit<FeatureDependency, 'id'>, dataSource: DataSource = 'mysql') {
  const id = `fdep-${Math.random().toString(36).substring(2, 9)}`;
  return await saveCollectionRecord('feature_dependencies', id, { ...dep, id }, dataSource);
}
