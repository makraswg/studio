
'use server';

import { saveCollectionRecord, getCollectionData, deleteCollectionRecord } from './mysql-actions';
import { Feature, FeatureLink, FeatureDependency, DataSource, FeatureProcessLink } from '@/lib/types';
import { logAuditEventAction } from './audit-actions';

const criticalityMap: Record<string, number> = { 'low': 1, 'medium': 2, 'high': 3 };
const reverseCriticalityMap: Record<number, 'low' | 'medium' | 'high'> = { 1: 'low', 2: 'medium', 3: 'high' };

/**
 * Berechnet die Gesamt-Kritikalität eines Merkmals basierend auf den zugeordneten Prozessen.
 */
async function calculateAggregateCriticality(featureId: string, dataSource: DataSource): Promise<'low' | 'medium' | 'high'> {
  const linksRes = await getCollectionData('feature_processes', dataSource);
  const links = (linksRes.data as FeatureProcessLink[])?.filter(l => l.featureId === featureId) || [];
  
  if (links.length === 0) return 'low';

  const maxVal = Math.max(...links.map(l => criticalityMap[l.criticality || 'low']));
  return reverseCriticalityMap[maxVal] || 'low';
}

/**
 * Speichert oder aktualisiert ein Merkmal.
 */
export async function saveFeatureAction(feature: Feature, dataSource: DataSource = 'mysql', actorEmail: string = 'system') {
  const isNew = !feature.id || feature.id === '';
  const id = isNew ? `feat-${Math.random().toString(36).substring(2, 9)}` : feature.id;
  const now = new Date().toISOString();
  
  // Aggregate criticality from context
  const aggregateCriticality = await calculateAggregateCriticality(id, dataSource);

  const data = {
    ...feature,
    id,
    criticality: aggregateCriticality,
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
 * Verknüpft ein Merkmal mit einem Prozess inklusive Kritikalität im Nutzungskontext.
 */
export async function linkFeatureToProcessAction(link: Omit<FeatureProcessLink, 'id'>, dataSource: DataSource = 'mysql') {
  const id = `fproc-${Math.random().toString(36).substring(2, 9)}`;
  const res = await saveCollectionRecord('feature_processes', id, { ...link, id }, dataSource);
  
  // Recalculate feature criticality
  const featureRes = await getCollectionData('features', dataSource);
  const feature = featureRes.data?.find((f: Feature) => f.id === link.featureId);
  if (feature) {
    await saveFeatureAction(feature, dataSource);
  }
  
  return res;
}

/**
 * Entfernt eine Prozessverknüpfung.
 */
export async function unlinkFeatureFromProcessAction(linkId: string, featureId: string, dataSource: DataSource = 'mysql') {
  const res = await deleteCollectionRecord('feature_processes', linkId, dataSource);
  
  // Recalculate
  const featureRes = await getCollectionData('features', dataSource);
  const feature = featureRes.data?.find((f: Feature) => f.id === featureId);
  if (feature) {
    await saveFeatureAction(feature, dataSource);
  }
  
  return res;
}

/**
 * Löscht ein Merkmal und alle Verknüpfungen.
 */
export async function deleteFeatureAction(featureId: string, dataSource: DataSource = 'mysql') {
  try {
    const linksRes = await getCollectionData('feature_links', dataSource);
    const links = linksRes.data?.filter(l => l.featureId === featureId) || [];
    for (const link of links) {
      await deleteCollectionRecord('feature_links', link.id, dataSource);
    }

    const procLinksRes = await getCollectionData('feature_processes', dataSource);
    const procLinks = procLinksRes.data?.filter((l: any) => l.featureId === featureId) || [];
    for (const link of procLinks) {
      await deleteCollectionRecord('feature_processes', link.id, dataSource);
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

export async function linkFeatureAction(link: Omit<FeatureLink, 'id'>, dataSource: DataSource = 'mysql') {
  const id = `flnk-${Math.random().toString(36).substring(2, 9)}`;
  return await saveCollectionRecord('feature_links', id, { ...link, id }, dataSource);
}

export async function addFeatureDependencyAction(dep: Omit<FeatureDependency, 'id'>, dataSource: DataSource = 'mysql') {
  const id = `fdep-${Math.random().toString(36).substring(2, 9)}`;
  return await saveCollectionRecord('feature_dependencies', id, { ...dep, id }, dataSource);
}
