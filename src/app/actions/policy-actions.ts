
'use server';

import { saveCollectionRecord, deleteCollectionRecord, getSingleRecord, getCollectionData } from './mysql-actions';
import { Policy, PolicyVersion, DataSource } from '@/lib/types';
import { logAuditEventAction } from './audit-actions';

/**
 * Speichert oder aktualisiert eine Richtlinie (Metadaten).
 */
export async function savePolicyAction(policy: Partial<Policy>, dataSource: DataSource = 'mysql', actorEmail: string = 'system') {
  const isNew = !policy.id;
  const id = policy.id || `pol-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  const data = {
    ...policy,
    id,
    tenantId: policy.tenantId || 'global',
    status: policy.status || 'draft',
    createdAt: policy.createdAt || now,
    updatedAt: now,
    currentVersion: policy.currentVersion || 1,
    reviewInterval: policy.reviewInterval || 365
  } as Policy;

  try {
    const res = await saveCollectionRecord('policies', id, data, dataSource);
    if (res.success) {
      await logAuditEventAction(dataSource as any, {
        tenantId: data.tenantId,
        actorUid: actorEmail,
        action: isNew ? `Richtlinie angelegt: ${data.title}` : `Richtlinie aktualisiert: ${data.title}`,
        entityType: 'policy',
        entityId: id,
        after: data
      });
    }
    return { success: true, policyId: id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Speichert eine neue Version oder Revision eines Richtlinientextes.
 */
export async function commitPolicyVersionAction(
  policyId: string, 
  versionNum: number, 
  content: string, 
  changelog: string,
  actorEmail: string,
  dataSource: DataSource = 'mysql',
  isMajor: boolean = false
) {
  try {
    const policyRes = await getSingleRecord('policies', policyId, dataSource);
    const policy = policyRes.data as Policy;
    if (!policy) throw new Error("Richtlinie nicht gefunden.");

    const now = new Date().toISOString();
    const verRes = await getCollectionData('policy_versions', dataSource);
    const lastVersion = verRes.data
      ?.filter((v: PolicyVersion) => v.policyId === policyId)
      .sort((a: any, b: any) => b.version - a.version || b.revision - a.revision)[0];

    let nextVersion = versionNum;
    let nextRevision = (lastVersion?.revision || 0) + 1;

    if (isMajor) {
      nextVersion = (lastVersion?.version || 0) + 1;
      nextRevision = 0;
    }

    const versionId = `pv-${policyId}-${nextVersion}-${nextRevision}`;
    const versionData: PolicyVersion = {
      id: versionId,
      policyId,
      version: nextVersion,
      revision: nextRevision,
      content,
      changelog,
      validFrom: now.split('T')[0],
      createdBy: actorEmail,
      createdAt: now
    };

    const res = await saveCollectionRecord('policy_versions', versionId, versionData, dataSource);
    if (res.success) {
      // Update metadata in policy table
      await saveCollectionRecord('policies', policyId, {
        ...policy,
        currentVersion: nextVersion,
        updatedAt: now,
        status: isMajor ? 'published' : (policy.status === 'draft' ? 'review' : policy.status)
      }, dataSource);

      await logAuditEventAction(dataSource as any, {
        tenantId: policy.tenantId,
        actorUid: actorEmail,
        action: `Richtlinie "${policy.title}": ${isMajor ? 'Neue Hauptversion freigegeben' : 'Revision gespeichert'} (V${nextVersion}.${nextRevision})`,
        entityType: 'policy',
        entityId: policyId,
        after: { version: nextVersion, revision: nextRevision, changelog }
      });
    }
    return res;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Löscht eine Richtlinie und alle Versionen permanent.
 */
export async function deletePolicyAction(id: string, dataSource: DataSource = 'mysql', actorEmail: string = 'system') {
  try {
    const policyRes = await getSingleRecord('policies', id, dataSource);
    const policy = policyRes.data as Policy;
    if (!policy) return { success: false, error: "Nicht gefunden" };

    const verRes = await getCollectionData('policy_versions', dataSource);
    const policyVersions = verRes.data?.filter((v: PolicyVersion) => v.policyId === id) || [];
    
    for (const v of policyVersions) {
      await deleteCollectionRecord('policy_versions', v.id, dataSource);
    }

    const res = await deleteCollectionRecord('policies', id, dataSource);
    if (res.success) {
      await logAuditEventAction(dataSource as any, {
        tenantId: policy.tenantId,
        actorUid: actorEmail,
        action: `Richtlinie permanent gelöscht: ${policy.title}`,
        entityType: 'policy',
        entityId: id,
        before: policy
      });
    }
    return res;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
