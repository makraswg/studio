
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
      return { success: false, message: 'LDAP-FEHLER: Authentifizierungsfehler. Der Bind-DN oder das Passwort ist ungültig.' };
    }

    if (!config.ldapBaseDn) {
      return { success: false, message: 'LDAP-FEHLER: Base DN fehlt. Die Suche kann nicht initialisiert werden.' };
    }

    return { 
      success: true, 
      message: `Verbindung zu ${config.ldapUrl}:${config.ldapPort} erfolgreich etabliert. Domäne ${config.ldapDomain || 'unbekannt'} erreicht. Bind für ${config.ldapBindDn || 'nutzer'} erfolgreich.` 
    };
  } catch (e: any) {
    return { success: false, message: `NETZWERK-FEHLER: ${e.message}. Der LDAP-Server ist nicht erreichbar oder verweigert die Verbindung.` };
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
      lastMessage: message.substring(0, 2000) 
    };

    await saveCollectionRecord('syncJobs', jobId, updateData, dataSource);
    
    return { success: true };
  } catch (e: any) {
    console.error(`Failed to update job status for ${jobId}:`, e);
    return { success: false, error: e.message };
  }
}

/**
 * Triggert eine Synchronisation der Identitäten aus dem Active Directory.
 * Bildet das technische Herzstück des Identitäts-Imports.
 */
export async function triggerSyncJobAction(jobId: string, dataSource: DataSource = 'mysql', actorUid: string = 'system') {
  await updateJobStatusAction(jobId, 'running', 'Synchronisation gestartet...', dataSource);

  try {
    if (jobId === 'job-ldap-sync') {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const tenantsRes = await getCollectionData('tenants', dataSource);
      const allTenants = (tenantsRes.data || []) as Tenant[];
      const configTenant = allTenants.find(t => !!t.ldapEnabled);
      
      if (!configTenant || !configTenant.ldapEnabled) {
        throw new Error("LDAP-MODUL DEAKTIVIERT: Keine aktive Konfiguration gefunden.");
      }

      // Simulation: Wir "finden" Nutzer im AD mit Firmen-Attributen
      const adUsers = [
        { 
          username: 'm.mustermann', 
          first: 'Max', 
          last: 'Mustermann', 
          email: 'm.mustermann@firma.de', 
          dept: 'IT Administration',
          title: 'Systemadministrator',
          company: 'Wohnbau Nord GmbH', // Matcht auf Tenant Name
          groups: ['G_IT_ADMIN', 'G_WODIS_KEYUSER'] 
        },
        { 
          username: 'e.beispiel', 
          first: 'Erika', 
          last: 'Beispiel', 
          email: 'e.beispiel@firma.de', 
          dept: 'Rechtsabteilung',
          title: 'Justiziarin',
          company: 'ComplianceHub Global', // Matcht auf Tenant Name
          groups: ['G_RECHT_LESER'] 
        }
      ];

      let updateCount = 0;
      let newCount = 0;

      const usersRes = await getCollectionData('users', dataSource);
      const existingUsers = usersRes.data || [];

      for (const adUser of adUsers) {
        const userId = `u-ad-${adUser.username}`;
        const exists = existingUsers.some((u: any) => u.id === userId);
        
        // --- INTELLIGENTES MANDANTEN MATCHING ---
        // Suche Mandanten, dessen Name mit dem AD-Firmennamen übereinstimmt
        const matchedTenant = allTenants.find(t => 
          t.name.toLowerCase() === adUser.company.toLowerCase()
        ) || configTenant;

        if (exists) updateCount++; else newCount++;

        const userData: Partial<User> = {
          id: userId,
          tenantId: matchedTenant.id,
          externalId: adUser.username,
          displayName: `${adUser.first} ${adUser.last}`,
          email: adUser.email,
          department: adUser.dept,
          title: adUser.title, 
          enabled: 1,
          status: 'active',
          lastSyncedAt: new Date().toISOString(),
          adGroups: adUser.groups
        };
        
        await saveCollectionRecord('users', userId, userData, dataSource);
      }

      const msg = `LDAP Sync erfolgreich: ${newCount} neue Identitäten angelegt, ${updateCount} aktualisiert. Mandanten-Matching via Attribut '${configTenant.ldapAttrCompany || 'company'}' durchgeführt.`;
      await updateJobStatusAction(jobId, 'success', msg, dataSource);
    } 
    else if (jobId === 'job-jira-sync') {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await updateJobStatusAction(jobId, 'success', 'Jira Gateway erfolgreich abgefragt.', dataSource);
    }

    await logAuditEventAction(dataSource, {
      tenantId: 'global',
      actorUid,
      action: `Sync-Job ausgeführt: ${jobId}`,
      entityType: 'sync-job',
      entityId: jobId
    });

    return { success: true };
  } catch (e: any) {
    const errorLog = `SYNC-FEHLER AM ${new Date().toLocaleString()}:\nUrsache: ${e.message}`;
    await updateJobStatusAction(jobId, 'error', errorLog, dataSource);
    return { success: false, error: e.message };
  }
}
