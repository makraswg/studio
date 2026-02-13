
'use server';

import { saveCollectionRecord, getCollectionData } from './mysql-actions';
import { DataSource, SyncJob, Tenant, User } from '@/lib/types';
import { logAuditEventAction } from './audit-actions';
import { Client } from 'ldapts';

/**
 * Normalisiert Texte für den Vergleich (Umlaute und Sonderzeichen).
 */
function normalizeForMatch(str: string): string {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/ä/g, 'a').replace(/ae/g, 'a')
    .replace(/ö/g, 'o').replace(/oe/g, 'o')
    .replace(/ü/g, 'u').replace(/ue/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '') 
    .trim();
}

/**
 * Holt einen Attributwert sicher, auch wenn er ein Array ist.
 */
const safeGetAttribute = (entry: any, attributeName: string | undefined, defaultValue: string = ''): string => {
  if (!attributeName || !entry[attributeName]) return defaultValue;
  const value = entry[attributeName];
  if (Array.isArray(value)) {
    return String(value[0] || defaultValue);
  }
  return String(value || defaultValue);
};

/**
 * Prüft anhand des userAccountControl Bitmask-Wertes, ob ein AD-Konto deaktiviert ist.
 * Flag 0x2 = ACCOUNTDISABLE
 */
function isUserAccountDisabled(uac: any): boolean {
  const val = parseInt(String(uac || '0'), 10);
  if (isNaN(val)) return false;
  return (val & 2) === 2;
}

/**
 * Protokolliert ein LDAP-Ereignis für Debug-Zwecke.
 */
async function logLdapInteraction(
  dataSource: DataSource,
  tenantId: string,
  action: string,
  status: 'success' | 'error',
  message: string,
  details: any,
  actorUid: string = 'system'
) {
  const id = `log-${Math.random().toString(36).substring(2, 9)}`;
  const logEntry = {
    id,
    tenantId,
    timestamp: new Date().toISOString(),
    action,
    status,
    message,
    details: typeof details === 'string' ? details : JSON.stringify(details, null, 2),
    actorUid
  };
  await saveCollectionRecord('ldapLogs', id, logEntry, dataSource);
  
  if (dataSource === 'mysql') {
    try {
      const { dbQuery } = await import('@/lib/mysql');
      await dbQuery(`
        DELETE FROM ldapLogs 
        WHERE id NOT IN (
          SELECT id FROM (
            SELECT id FROM ldapLogs 
            WHERE tenantId = ? 
            ORDER BY timestamp DESC 
            LIMIT 200
          ) x
        ) AND tenantId = ?`, 
        [tenantId, tenantId]
      );
    } catch (e) {}
  }
}

/**
 * Erzeugt die TLS-Konfiguration basierend auf den Mandanteneinstellungen.
 */
function getTlsOptions(config: Partial<Tenant>) {
  const options: any = {
    rejectUnauthorized: !config.ldapAllowInvalidSsl,
  };

  if (config.ldapClientCert) {
    options.ca = [config.ldapClientCert];
  }

  return options;
}

/**
 * Testet die LDAP-Verbindung durch einen realen Bind und Search.
 */
export async function testLdapConnectionAction(config: Partial<Tenant>): Promise<{ success: boolean; message: string }> {
  if (!config.ldapUrl || !config.ldapPort || !config.ldapBindDn || !config.ldapBindPassword) {
    return { success: false, message: 'Server-URL, Port und Bind-Daten sind erforderlich.' };
  }

  const tenantId = config.id || 'unknown';
  const url = `${config.ldapUrl.startsWith('ldap') ? config.ldapUrl : 'ldap://' + config.ldapUrl}:${config.ldapPort}`;
  const tlsOptions = getTlsOptions(config);
  
  const client = new Client({ 
    url, 
    timeout: 5000, 
    connectTimeout: 5000,
    tlsOptions: url.startsWith('ldaps') ? tlsOptions : undefined
  });

  try {
    if (!url.startsWith('ldaps') && config.ldapUseTls) {
      await client.startTLS(tlsOptions);
    }

    await client.bind(config.ldapBindDn, config.ldapBindPassword);
    
    await logLdapInteraction('mysql', tenantId, 'Connection Test', 'success', 
      'LDAP Bind erfolgreich. Prüfe Lesezugriff auf Base DN...', 
      { url, bindDn: config.ldapBindDn, tls: !!config.ldapUseTls, ignoreCertErrors: !!config.ldapAllowInvalidSsl }
    );

    const { searchEntries } = await client.search(config.ldapBaseDn || '', {
      scope: 'sub',
      filter: config.ldapUserFilter || '(objectClass=user)',
      sizeLimit: 1
    });

    await logLdapInteraction('mysql', tenantId, 'Read Probe', 'success', 
      `Integrität bestätigt. ${searchEntries.length} Test-Eintrag gelesen.`, 
      { filter: config.ldapUserFilter, entriesFound: searchEntries.length }
    );

    return { 
      success: true, 
      message: `Verbindung erfolgreich. Authentifizierung ok und Lesezugriff auf Base DN bestätigt.` 
    };
  } catch (e: any) {
    let errorMsg = e.message;
    await logLdapInteraction('mysql', tenantId, 'Connection Test', 'error', errorMsg, { 
      url, 
      bindDn: config.ldapBindDn, 
      error: e.stack
    });
    return { success: false, message: `LDAP-FEHLER: ${errorMsg}` };
  } finally {
    try { await client.unbind(); } catch (e) {}
  }
}

/**
 * Ruft verfügbare Benutzer aus dem AD ab.
 */
export async function getAdUsersAction(config: Partial<Tenant>, dataSource: DataSource = 'mysql', searchQuery: string = '') {
  if (!config.ldapUrl || !config.ldapBindDn || !config.ldapBindPassword) {
    throw new Error("LDAP-Konfiguration unvollständig.");
  }

  const tenantId = config.id || 'global';
  const url = `${config.ldapUrl.startsWith('ldap') ? config.ldapUrl : 'ldap://' + config.ldapUrl}:${config.ldapPort}`;
  const tlsOptions = getTlsOptions(config);

  const client = new Client({ 
    url, 
    timeout: 10000,
    tlsOptions: url.startsWith('ldaps') ? tlsOptions : undefined
  });

  try {
    if (!url.startsWith('ldaps') && config.ldapUseTls) {
      await client.startTLS(tlsOptions);
    }

    await client.bind(config.ldapBindDn, config.ldapBindPassword);
    
    let filter = config.ldapUserFilter || '(objectClass=user)';
    if (searchQuery) {
      const escapedQuery = searchQuery.replace(/[()]/g, '');
      filter = `(&${filter}(|(sAMAccountName=*${escapedQuery}*)(displayName=*${escapedQuery}*)(mail=*${escapedQuery}*)(sn=*${escapedQuery}*)))`;
    }

    const { searchEntries } = await client.search(config.ldapBaseDn || '', {
      scope: 'sub',
      filter: filter,
      sizeLimit: 250,
      attributes: [
        config.ldapAttrUsername || 'sAMAccountName',
        config.ldapAttrFirstname || 'givenName',
        config.ldapAttrLastname || 'sn',
        config.ldapAttrEmail || 'mail',
        config.ldapAttrDepartment || 'department',
        config.ldapAttrCompany || 'company',
        config.ldapAttrGroups || 'memberOf',
        'displayName',
        'title',
        'userAccountControl'
      ]
    });

    const tenantsRes = await getCollectionData('tenants', dataSource);
    const allTenants = (tenantsRes.data || []) as Tenant[];

    return searchEntries.map((entry: any) => {
      const company = safeGetAttribute(entry, config.ldapAttrCompany, '');
      const normAdCompany = normalizeForMatch(company);
      let matchedTenant = allTenants.find(t => normalizeForMatch(t.name) === normAdCompany || normalizeForMatch(t.slug) === normAdCompany);

      const username = safeGetAttribute(entry, config.ldapAttrUsername, 'sAMAccountName');
      const isDisabled = isUserAccountDisabled(entry.userAccountControl);

      return {
        username,
        first: safeGetAttribute(entry, config.ldapAttrFirstname, ''),
        last: safeGetAttribute(entry, config.ldapAttrLastname, ''),
        displayName: safeGetAttribute(entry, 'displayName', ''),
        email: safeGetAttribute(entry, config.ldapAttrEmail, ''),
        dept: safeGetAttribute(entry, config.ldapAttrDepartment, ''),
        title: safeGetAttribute(entry, 'title', 'AD User'),
        company,
        isDisabled,
        matchedTenantId: matchedTenant?.id || null,
        matchedTenantName: matchedTenant?.name || 'Kein exakter Treffer'
      };
    });
  } catch (e: any) {
    await logLdapInteraction(dataSource, tenantId, 'AD Search Error', 'error', e.message, { stack: e.stack });
    throw new Error("LDAP Abfrage fehlgeschlagen: " + e.message);
  } finally {
    try { await client.unbind(); } catch (e) {}
  }
}

/**
 * Importiert eine Liste von AD-Benutzern in den Hub.
 */
export async function importUsersAction(usersToImport: any[], dataSource: DataSource = 'mysql', actorEmail: string = 'system') {
  let count = 0;
  try {
    for (const adUser of usersToImport) {
      const userId = `u-ad-${adUser.username}`;
      const userData = {
        id: userId,
        tenantId: adUser.matchedTenantId || 't1',
        externalId: adUser.username,
        displayName: adUser.displayName || `${adUser.first || ''} ${adUser.last || ''}`.trim() || adUser.username,
        email: adUser.email,
        department: adUser.dept || '',
        title: adUser.title || '',
        enabled: !adUser.isDisabled,
        status: adUser.isDisabled ? 'archived' : 'active',
        lastSyncedAt: new Date().toISOString()
      };

      const res = await saveCollectionRecord('users', userId, userData, dataSource);
      if (res.success) count++;
    }

    await logAuditEventAction(dataSource, {
      tenantId: 'global',
      actorUid: actorEmail,
      action: `${count} Benutzer via AD-Import Tool in den Hub übernommen.`,
      entityType: 'sync',
      entityId: 'manual-import'
    });

    return { success: true, count };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Triggert einen automatischen Sync-Lauf (Update existierender Profile).
 */
export async function triggerSyncJobAction(jobId: string, dataSource: DataSource = 'mysql', actorUid: string = 'system') {
  if (jobId !== 'job-ldap-sync') return { success: false, error: 'Job nicht unterstützt' };

  await updateJobStatusAction(jobId, 'running', 'Voll-Synchronisation gestartet...', dataSource);
  
  try {
    const tenantsRes = await getCollectionData('tenants', dataSource);
    const usersRes = await getCollectionData('users', dataSource);
    
    const activeTenants = (tenantsRes.data || []).filter((t: Tenant) => t.ldapEnabled);
    const hubUsers = (usersRes.data || []) as User[];
    
    let totalUpdated = 0;
    let totalDisabled = 0;

    for (const tenant of activeTenants) {
      try {
        const adUsers = await getAdUsersAction(tenant, dataSource);
        const tenantUsers = hubUsers.filter(hu => hu.tenantId === tenant.id && !!hu.externalId);

        for (const hubUser of tenantUsers) {
          const adMatch = adUsers.find(au => au.username.toLowerCase() === hubUser.externalId.toLowerCase());
          
          if (adMatch) {
            const shouldBeEnabled = !adMatch.isDisabled;
            const needsUpdate = hubUser.enabled !== (shouldBeEnabled ? 1 : 0) || 
                                hubUser.displayName !== adMatch.displayName ||
                                hubUser.email !== adMatch.email;

            if (needsUpdate) {
              const updatedUser = {
                ...hubUser,
                displayName: adMatch.displayName || hubUser.displayName,
                email: adMatch.email || hubUser.email,
                department: adMatch.dept || hubUser.department,
                enabled: shouldBeEnabled,
                status: shouldBeEnabled ? 'active' : 'archived',
                lastSyncedAt: new Date().toISOString()
              };
              await saveCollectionRecord('users', hubUser.id, updatedUser, dataSource);
              totalUpdated++;
              if (!shouldBeEnabled && hubUser.enabled) totalDisabled++;
            }
          }
        }
        
        await logLdapInteraction(dataSource, tenant.id, 'Full Sync', 'success', 
          `Synchronisation abgeschlossen. ${totalUpdated} Profile aktualisiert.`, 
          { updated: totalUpdated, deactivated: totalDisabled }
        );
      } catch (tenantErr: any) {
        console.error(`Sync error for tenant ${tenant.name}:`, tenantErr);
      }
    }

    const msg = `Lauf beendet. ${totalUpdated} Updates durchgeführt (${totalDisabled} Deaktivierungen).`;
    await updateJobStatusAction(jobId, 'success', msg, dataSource);
    
    await logAuditEventAction(dataSource, {
      tenantId: 'global',
      actorUid,
      action: `LDAP Voll-Sync: ${msg}`,
      entityType: 'sync',
      entityId: jobId
    });

    return { success: true };
  } catch (e: any) {
    await updateJobStatusAction(jobId, 'error', e.message, dataSource);
    return { success: false, error: e.message };
  }
}

async function updateJobStatusAction(jobId: string, status: string, message: string, dataSource: DataSource) {
  const data = { id: jobId, lastRun: new Date().toISOString(), lastStatus: status, lastMessage: message };
  await saveCollectionRecord('syncJobs', jobId, data, dataSource);
}
