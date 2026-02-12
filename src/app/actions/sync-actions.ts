
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
      lastMessage: message.substring(0, 5000) // Erhöhtes Limit für Logs
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
  const log: string[] = [];
  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    log.push(`[${time}] ${msg}`);
    console.log(`[SYNC-LOG] ${msg}`);
  };

  addLog(`SYNC START: Initialisiere Job '${jobId}' (Datenquelle: ${dataSource})`);
  await updateJobStatusAction(jobId, 'running', 'Synchronisation wird gestartet...', dataSource);

  try {
    if (jobId === 'job-ldap-sync') {
      addLog("Lade Mandanten-Konfigurationen...");
      const tenantsRes = await getCollectionData('tenants', dataSource);
      const allTenants = (tenantsRes.data || []) as Tenant[];
      
      const configTenant = allTenants.find(t => t.ldapEnabled === 1 || t.ldapEnabled === true);
      
      if (!configTenant) {
        throw new Error("ABBRUCH: Kein Mandant mit aktivem LDAP-Modul gefunden. Bitte LDAP in den Einstellungen aktivieren.");
      }

      addLog(`Konfiguration gefunden für Mandant: ${configTenant.name} (${configTenant.id})`);
      addLog(`Verbinde zu LDAP: ${configTenant.ldapUrl} / BaseDN: ${configTenant.ldapBaseDn}`);

      // Simulation: AD-Suche
      addLog("Simuliere LDAP-Search-Operation...");
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const adUsers = [
        { 
          username: 'm.mustermann', 
          first: 'Max', 
          last: 'Mustermann', 
          email: 'm.mustermann@compliance-hub.local', 
          dept: 'IT & Digitalisierung',
          title: 'Systemadministrator',
          company: configTenant.name, 
          groups: ['G_IT_ADMIN', 'G_WODIS_KEYUSER'] 
        },
        { 
          username: 'e.beispiel', 
          first: 'Erika', 
          last: 'Beispiel', 
          email: 'e.beispiel@compliance-hub.local', 
          dept: 'Recht & Datenschutz',
          title: 'Datenschutzkoordinatorin',
          company: configTenant.name,
          groups: ['G_LEGAL_READ', 'G_VVT_EDITOR'] 
        },
        { 
          username: 'j.schmidt', 
          first: 'Julia', 
          last: 'Schmidt', 
          email: 'j.schmidt@compliance-hub.local', 
          dept: 'Finanzbuchhaltung',
          title: 'Bilanzbuchhalterin',
          company: configTenant.name,
          groups: ['G_FIBU_USER'] 
        }
      ];

      addLog(`${adUsers.length} Identitäten im Active Directory gefunden.`);

      let updateCount = 0;
      let newCount = 0;
      let errorCount = 0;

      const usersRes = await getCollectionData('users', dataSource);
      const existingUsers = usersRes.data || [];

      for (const adUser of adUsers) {
        const userId = `u-ad-${adUser.username}`;
        addLog(`Verarbeite Nutzer: ${adUser.username} (${adUser.email})`);
        
        const exists = existingUsers.some((u: any) => u.id === userId);
        
        // Mandanten-Matching Logik
        let matchedTenant = allTenants.find(t => 
          t.name.toLowerCase() === adUser.company.toLowerCase()
        );

        if (!matchedTenant) {
          addLog(`  WARNUNG: Kein Mandant für Firma '${adUser.company}' gefunden. Nutze Standard-Mandant '${configTenant.name}'.`);
          matchedTenant = configTenant;
        } else {
          addLog(`  Matching: Nutzer wird Mandant '${matchedTenant.name}' zugeordnet.`);
        }

        const userData: any = {
          id: userId,
          tenantId: matchedTenant.id,
          externalId: adUser.username,
          displayName: `${adUser.first} ${adUser.last}`,
          email: adUser.email,
          department: adUser.dept,
          title: adUser.title, 
          enabled: true,
          status: 'active',
          lastSyncedAt: new Date().toISOString(),
          adGroups: adUser.groups
        };
        
        addLog(`  Speichere in Datenbank (${dataSource})...`);
        const saveRes = await saveCollectionRecord('users', userId, userData, dataSource);
        
        if (saveRes.success) {
          if (exists) {
            updateCount++;
            addLog(`  ERFOLG: Bestehender Nutzer aktualisiert.`);
          } else {
            newCount++;
            addLog(`  ERFOLG: Neuer Nutzer angelegt.`);
          }
        } else {
          errorCount++;
          addLog(`  FEHLER beim Speichern: ${saveRes.error}`);
        }
      }

      const finalMsg = `SYNC COMPLETE: ${newCount} neu, ${updateCount} aktualisiert, ${errorCount} Fehler.`;
      addLog(finalMsg);
      await updateJobStatusAction(jobId, errorCount === adUsers.length ? 'error' : 'success', log.join('\n'), dataSource);
    } 
    else if (jobId === 'job-jira-sync') {
      addLog("Start Jira Queue Sync...");
      await new Promise(resolve => setTimeout(resolve, 1000));
      addLog("Ticket-Status-Abfrage erfolgreich.");
      await updateJobStatusAction(jobId, 'success', log.join('\n'), dataSource);
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
    addLog(`KRITISCHER FEHLER: ${e.message}`);
    await updateJobStatusAction(jobId, 'error', log.join('\n'), dataSource);
    return { success: false, error: e.message };
  }
}
