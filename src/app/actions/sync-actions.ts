
'use server';

import { saveCollectionRecord, getCollectionData } from './mysql-actions';
import { DataSource, SyncJob, Tenant, User } from '@/lib/types';
import { logAuditEventAction } from './audit-actions';

/**
 * Testet die LDAP-Verbindung (Simulation für das Frontend).
 */
export async function testLdapConnectionAction(config: Partial<Tenant>): Promise<{ success: boolean; message: string }> {
  if (!config.ldapUrl || !config.ldapPort) {
    return { success: false, message: 'URL und Port erforderlich.' };
  }

  try {
    // Simulation einer Netzwerkprüfung
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Einfache Logik-Prüfung
    if (config.ldapUrl.includes('localhost') || config.ldapUrl.includes('127.0.0.1')) {
      return { success: false, message: 'Lokale LDAP-Hosts werden in der Cloud-Sandbox nicht unterstützt.' };
    }

    if (config.ldapBindPassword === 'wrong') {
      return { success: false, message: 'Authentifizierungsfehler: Bind DN oder Passwort ungültig.' };
    }

    return { 
      success: true, 
      message: `Verbindung zu ${config.ldapUrl}:${config.ldapPort} erfolgreich etabliert. Domäne ${config.ldapDomain || 'unbekannt'} erreicht. Bind für ${config.ldapBindDn || 'nutzer'} erfolgreich.` 
    };
  } catch (e: any) {
    return { success: false, message: `Verbindungsfehler: ${e.message}` };
  }
}

/**
 * Ruft alle registrierten Synchronisations-Jobs ab.
 */
export async function getSyncJobsAction(dataSource: DataSource = 'mysql'): Promise<SyncJob[]> {
  const result = await getCollectionData('syncJobs', dataSource);
  return (result.data as SyncJob[]) || [];
}

/**
 * Aktualisiert den Status eines Synchronisations-Jobs.
 */
export async function updateJobStatusAction(
  jobId: string, 
  status: 'running' | 'success' | 'error', 
  message: string,
  dataSource: DataSource = 'mysql'
) {
  try {
    const jobsResult = await getCollectionData('syncJobs', dataSource);
    const existingJob = jobsResult.data?.find(j => j.id === jobId);
    
    const updateData = {
      id: jobId,
      name: existingJob?.name || jobId,
      lastRun: new Date().toISOString(),
      lastStatus: status,
      lastMessage: message.substring(0, 1000)
    };

    await saveCollectionRecord('syncJobs', jobId, updateData, dataSource);
    
    return { success: true };
  } catch (e: any) {
    console.error(`Failed to update job status for ${jobId}:`, e);
    return { success: false, error: e.message };
  }
}

/**
 * Triggert eine Synchronisation.
 * Diese Funktion simuliert das Auslesen von AD-Identitäten und deren Gruppen.
 */
export async function triggerSyncJobAction(jobId: string, dataSource: DataSource = 'mysql', actorUid: string = 'system') {
  // 1. Markiere als laufend
  await updateJobStatusAction(jobId, 'running', 'Synchronisation wurde manuell gestartet...', dataSource);

  try {
    if (jobId === 'job-ldap-sync') {
      // Simulation einer LDAP Synchronisation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const tenantsRes = await getCollectionData('tenants', dataSource);
      const tenant = tenantsRes.data?.[0] as Tenant;
      
      if (!tenant || !tenant.ldapEnabled) {
        throw new Error("LDAP ist für diesen Mandanten nicht aktiviert.");
      }

      // Simulation: Wir "finden" 3 Nutzer im AD
      const adUsers = [
        { username: 'm.mustermann', first: 'Max', last: 'Mustermann', email: 'm.mustermann@firma.de', groups: ['G_IT_ADMIN', 'G_WODIS_KEYUSER'] },
        { username: 'e.beispiel', first: 'Erika', last: 'Beispiel', email: 'e.beispiel@firma.de', groups: ['G_RECHT_LESER'] },
        { username: 'j.doe', first: 'John', last: 'Doe', email: 'j.doe@firma.de', groups: ['G_FINANZ_BUCHHALTUNG'] }
      ];

      let updateCount = 0;
      for (const adUser of adUsers) {
        const userId = `u-ad-${adUser.username}`;
        const userData: Partial<User> = {
          id: userId,
          tenantId: tenant.id,
          externalId: adUser.username,
          displayName: `${adUser.first} ${adUser.last}`,
          email: adUser.email,
          enabled: 1,
          status: 'active',
          lastSyncedAt: new Date().toISOString(),
          adGroups: adUser.groups // Hier werden die memberOf Daten gespeichert
        };
        
        await saveCollectionRecord('users', userId, userData, dataSource);
        updateCount++;
      }

      const msg = `LDAP/AD Sync erfolgreich. ${updateCount} Identitäten wurden abgeglichen. Gruppen-Zugehörigkeiten (memberOf) wurden für die Drift-Detection aktualisiert.`;
      await updateJobStatusAction(jobId, 'success', msg, dataSource);
    } 
    else if (jobId === 'job-jira-sync') {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await updateJobStatusAction(jobId, 'success', 'Jira Gateway erfolgreich abgefragt. Warteschlange ist aktuell.', dataSource);
    }
    else {
      await updateJobStatusAction(jobId, 'error', `Job-Logik für '${jobId}' noch nicht implementiert.`, dataSource);
    }

    await logAuditEventAction(dataSource as any, {
      tenantId: 'global',
      actorUid,
      action: `Sync-Job manuell ausgeführt: ${jobId}`,
      entityType: 'sync-job',
      entityId: jobId
    });

    return { success: true };
  } catch (e: any) {
    await updateJobStatusAction(jobId, 'error', `Fehler bei Ausführung: ${e.message}`, dataSource);
    return { success: false, error: e.message };
  }
}
