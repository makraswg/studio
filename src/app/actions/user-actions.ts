'use server';

import { saveCollectionRecord, getCollectionData, getSingleRecord, deleteCollectionRecord } from './mysql-actions';
import { DataSource, User, Assignment, Entitlement, Resource, Task, TaskComment } from '@/lib/types';
import { logAuditEventAction } from './audit-actions';
import { createJiraTicket, getJiraConfigs } from './jira-actions';

/**
 * Startet den Offboarding-Prozess für einen Mitarbeiter.
 */
export async function startOffboardingAction(
  userId: string, 
  offboardingDate: string,
  dataSource: DataSource = 'mysql',
  actorEmail: string = 'system'
) {
  try {
    const userRes = await getSingleRecord('users', userId, dataSource);
    const user = userRes.data as User;
    if (!user) throw new Error("Benutzer nicht gefunden.");

    const now = new Date().toISOString();
    const targetTenantId = user.tenantId;

    const assignmentsRes = await getCollectionData('assignments', dataSource);
    const userAssignments = assignmentsRes.data?.filter((a: Assignment) => a.userId === userId && a.status === 'active') || [];

    const entitlementsRes = await getCollectionData('entitlements', dataSource);
    const resourcesRes = await getCollectionData('resources', dataSource);

    let jiraDescription = `Automatisches OFFBOARDING-Ticket erstellt via ComplianceHub Gateway.\n\n`;
    jiraDescription += `BENUTZERDATEN:\n`;
    jiraDescription += `- Name: ${user.displayName}\n`;
    jiraDescription += `- E-Mail: ${user.email}\n`;
    jiraDescription += `- Austrittsdatum: ${offboardingDate}\n\n`;
    jiraDescription += `ZU ENTZIEHENDE BERECHTIGUNGEN (${userAssignments.length}):\n`;

    for (const a of userAssignments) {
      const ent = entitlementsRes.data?.find((e: Entitlement) => e.id === a.entitlementId);
      const res = resourcesRes.data?.find((r: Resource) => r.id === ent?.resourceId);
      if (ent && res) {
        jiraDescription += `- [${res.name}] : ${ent.name}\n`;
      }
    }

    const configs = await getJiraConfigs(dataSource);
    let jiraKey = 'manuell';
    if (configs.length > 0 && configs[0].enabled) {
      const res = await createJiraTicket(configs[0].id, `Offboarding: ${user.displayName}`, jiraDescription, dataSource);
      if (res.success) jiraKey = res.key!;
    }

    const updatedUser = { ...user, enabled: false, status: 'archived', offboardingDate };
    await saveCollectionRecord('users', userId, updatedUser, dataSource);

    for (const a of userAssignments) {
      const updatedAss = { ...a, status: 'pending_removal', jiraIssueKey: jiraKey };
      await saveCollectionRecord('assignments', a.id, updatedAss, dataSource);
    }

    await logAuditEventAction(dataSource, {
      tenantId: targetTenantId,
      actorUid: actorEmail,
      action: `Offboarding Prozess gestartet: ${user.displayName} (Jira: ${jiraKey})`,
      entityType: 'user',
      entityId: userId,
      after: updatedUser
    });

    return { success: true, jiraKey };
  } catch (e: any) {
    console.error("Offboarding Error:", e);
    return { success: false, error: e.message };
  }
}

/**
 * Prüft auf Abhängigkeiten und löscht einen Benutzer permanent.
 */
export async function deleteUserAction(userId: string, dataSource: DataSource = 'mysql', actorEmail: string = 'system') {
  try {
    const userRes = await getSingleRecord('users', userId, dataSource);
    const user = userRes.data as User;
    if (!user) throw new Error("Benutzer nicht gefunden.");

    const blockers: string[] = [];

    // 1. Check Assignments
    const assRes = await getCollectionData('assignments', dataSource);
    const userAss = assRes.data?.filter((a: Assignment) => a.userId === userId && a.status !== 'removed') || [];
    if (userAss.length > 0) {
      blockers.push(`Der Benutzer hat noch ${userAss.length} aktive oder angeforderte Berechtigungen.`);
    }

    // 2. Check Tasks
    const taskRes = await getCollectionData('tasks', dataSource);
    const userTasks = taskRes.data?.filter((t: Task) => t.assigneeId === userId || t.creatorId === userId) || [];
    if (userTasks.length > 0) {
      blockers.push(`Der Benutzer ist als Verantwortlicher oder Ersteller in ${userTasks.length} Aufgaben eingetragen.`);
    }

    // 3. Check Comments
    const commRes = await getCollectionData('task_comments', dataSource);
    const userComments = commRes.data?.filter((c: TaskComment) => c.userId === userId) || [];
    if (userComments.length > 0) {
      blockers.push(`Der Benutzer hat ${userComments.length} Kommentare im Aufgaben-Journal hinterlassen.`);
    }

    if (blockers.length > 0) {
      return { success: false, error: "Löschen nicht möglich", blockers };
    }

    const res = await deleteCollectionRecord('users', userId, dataSource);
    if (res.success) {
      await logAuditEventAction(dataSource, {
        tenantId: user.tenantId,
        actorUid: actorEmail,
        action: `Benutzer permanent gelöscht: ${user.displayName}`,
        entityType: 'user',
        entityId: userId,
        before: user
      });
    }
    return res;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
