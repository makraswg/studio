
'use server';

import { saveCollectionRecord, getCollectionData } from './mysql-actions';
import { DataSource, SyncJob, Tenant } from '@/lib/types';
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
 */
export async function triggerSyncJobAction(jobId: string, dataSource: DataSource = 'mysql', actorUid: string = 'system') {
  // 1. Markiere als laufend
  await updateJobStatusAction(jobId, 'running', 'Synchronisation wurde manuell gestartet...', dataSource);

  try {
    // Hier würde die Logik je nach Job-ID verzweigen
    if (jobId === 'job-ldap-sync') {
      // Simulation einer LDAP Synchronisation
      await new Promise(resolve => setTimeout(resolve, 2500));
      // In einer realen Welt würden hier LDAP-Queries laufen, die auch memberOf auslesen
      await updateJobStatusAction(jobId, 'success', 'LDAP/AD Sync erfolgreich. Benutzer-Attribute und Gruppen-Zugehörigkeiten (memberOf) wurden abgeglichen.', dataSource);
    } 
    else if (jobId === 'job-jira-sync') {
      // Jira Sync Simulation
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
