'use server';

import { getCollectionData } from './mysql-actions';
import { JiraConfig, JiraSyncItem, Resource, Entitlement } from '@/lib/types';

/**
 * Hilfsfunktion zum Bereinigen der Jira-URL.
 */
function cleanJiraUrl(url: string): string {
  if (!url) return '';
  let cleaned = url.trim();
  
  try {
    const parsed = new URL(cleaned);
    return `${parsed.protocol}//${parsed.host}`;
  } catch (e) {
    cleaned = cleaned.replace(/\/$/, '');
    const segments = ['/rest/', '/jira/', '/assets/', '/browse/', '/projects/'];
    for (const segment of segments) {
      if (cleaned.includes(segment)) {
        cleaned = cleaned.split(segment)[0];
      }
    }
    return cleaned;
  }
}

/**
 * Ruft die Jira-Konfiguration ab.
 */
export async function getJiraConfigs(): Promise<JiraConfig[]> {
  const result = await getCollectionData('jiraConfigs');
  return (result.data as JiraConfig[]) || [];
}

/**
 * Ruft verfügbare Jira Assets Workspaces ab via Discovery-API.
 */
export async function getJiraWorkspacesAction(configData: { url: string; email: string; apiToken: string }): Promise<{ 
  success: boolean; 
  workspaces?: { id: string; name: string }[]; 
  error?: string;
  details?: string;
}> {
  if (!configData.url || !configData.email || !configData.apiToken) {
    return { success: false, error: 'URL, E-Mail und API-Token sind erforderlich.' };
  }

  const baseUrl = cleanJiraUrl(configData.url);
  const auth = Buffer.from(`${configData.email}:${configData.apiToken}`).toString('base64');

  try {
    const response = await fetch(`${baseUrl}/rest/servicedeskapi/assets/workspace`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { 
        success: false, 
        error: `Jira Assets Discovery Fehler (${response.status})`,
        details: errorText.substring(0, 200)
      };
    }

    const data = await response.json();
    const workspaces = (data.values || data || []).map((w: any) => ({
      id: w.workspaceId || w.id,
      name: w.workspaceName || w.name || "Standard Workspace"
    }));

    return { success: true, workspaces };
  } catch (e: any) {
    return { success: false, error: 'Verbindungsfehler', details: e.message };
  }
}

/**
 * Synchronisiert Ressourcen und Rollen als Assets nach Jira.
 */
export async function syncAssetsToJiraAction(configId: string): Promise<{ success: boolean; message: string; error?: string }> {
  const configs = await getJiraConfigs();
  const config = configs.find(c => c.id === configId);
  
  if (!config || !config.enabled || !config.assetsWorkspaceId) {
    return { success: false, message: 'Jira Assets nicht konfiguriert.' };
  }

  const baseUrl = cleanJiraUrl(config.url);
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  
  // Wir nutzen den Workspace-spezifischen API-Endpunkt
  // Hinweis: Viele Assets-APIs erwarten die workspaceId im Pfad
  const assetsApiBase = `${baseUrl}/rest/assets/1.0`; 

  try {
    // 1. Daten aus lokaler DB laden
    const resResult = await getCollectionData('resources');
    const entResult = await getCollectionData('entitlements');
    const resources = (resResult.data as Resource[]) || [];
    const entitlements = (entResult.data as Entitlement[]) || [];

    let createdCount = 0;
    let updatedCount = 0;

    // 2. Ressourcen synchronisieren
    if (config.assetsResourceObjectTypeId) {
      for (const res of resources) {
        // Prüfen ob Objekt existiert (vereinfacht via Name-Suche)
        const createRes = await fetch(`${assetsApiBase}/object/create`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            objectTypeId: config.assetsResourceObjectTypeId,
            attributes: [
              {
                objectTypeAttributeId: "1", // In der Regel ID 1 für "Name"
                objectAttributeValues: [{ value: res.name }]
              }
            ]
          })
        });
        if (createRes.ok) createdCount++;
      }
    }

    // 3. Rollen synchronisieren
    if (config.assetsRoleObjectTypeId) {
      for (const ent of entitlements) {
        const createEnt = await fetch(`${assetsApiBase}/object/create`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            objectTypeId: config.assetsRoleObjectTypeId,
            attributes: [
              {
                objectTypeAttributeId: "1", // Name
                objectAttributeValues: [{ value: ent.name }]
              }
            ]
          })
        });
        if (createEnt.ok) createdCount++;
      }
    }

    return { 
      success: true, 
      message: `${createdCount} Objekte erfolgreich nach Jira Assets übertragen (Workspace: ${config.assetsWorkspaceId}).` 
    };
  } catch (e: any) {
    return { success: false, message: 'Synchronisation fehlgeschlagen', error: e.message };
  }
}

/**
 * Testet die Jira-Verbindung.
 */
export async function testJiraConnectionAction(configData: Partial<JiraConfig>): Promise<{ 
  success: boolean; 
  message: string; 
  details?: string;
  count?: number;
}> {
  if (!configData.url || !configData.email || !configData.apiToken) {
    return { success: false, message: 'Unvollständige Zugangsdaten.' };
  }

  const url = cleanJiraUrl(configData.url);
  const auth = Buffer.from(`${configData.email}:${configData.apiToken}`).toString('base64');

  try {
    const testRes = await fetch(`${url}/rest/api/3/myself`, {
      headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
      cache: 'no-store'
    });

    if (!testRes.ok) {
      return { success: false, message: `Authentifizierungsfehler (${testRes.status})` };
    }

    const userData = await testRes.json();
    const jql = `project = "${configData.projectKey}" AND status = "${configData.approvedStatusName}"`;
    
    const searchRes = await fetch(`${url}/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ jql, maxResults: 1 }),
      cache: 'no-store'
    });

    const searchData = searchRes.ok ? await searchRes.json() : { total: 0 };

    return { 
      success: true, 
      message: `Erfolgreich verbunden als ${userData.displayName}.`,
      count: searchData.total
    };
  } catch (e: any) {
    return { success: false, message: `Verbindungsfehler: ${e.message}` };
  }
}

/**
 * Erstellt ein Ticket in Jira.
 */
export async function createJiraTicket(configId: string, summary: string, description: string): Promise<{ success: boolean; key?: string; error?: string }> {
  const configs = await getJiraConfigs();
  const config = configs.find(c => c.id === configId);
  if (!config || !config.enabled) return { success: false, error: 'Jira nicht konfiguriert.' };

  const url = cleanJiraUrl(config.url);
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

  try {
    const response = await fetch(`${url}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          project: { key: config.projectKey },
          summary: summary,
          description: {
            type: 'doc',
            version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }]
          },
          issuetype: { name: config.issueTypeName || 'Service Request' }
        }
      }),
      cache: 'no-store'
    });

    const data = await response.json();
    return response.ok ? { success: true, key: data.key } : { success: false, error: 'Fehler beim Erstellen.' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Ruft genehmigte Zugriffsanfragen aus Jira ab.
 */
export async function fetchJiraApprovedRequests(configId: string): Promise<JiraSyncItem[]> {
  const configs = await getJiraConfigs();
  const config = configs.find(c => c.id === configId);
  if (!config || !config.enabled) return [];

  const url = cleanJiraUrl(config.url);
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

  try {
    const jql = `project = "${config.projectKey}" AND status = "${config.approvedStatusName}"${config.issueTypeName ? ` AND "Request Type" = "${config.issueTypeName}"` : ''}`;

    const response = await fetch(`${url}/rest/api/3/search/jql`, {
      method: 'POST',
      headers: { 
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        jql: jql,
        maxResults: 50,
        fields: ["summary", "status", "reporter", "created", "description", "*navigable"]
      }),
      cache: 'no-store'
    });

    if (!response.ok) return [];
    const data = await response.json();
    if (!data.issues) return [];

    const entData = await getCollectionData('entitlements');
    const localEntitlements = (entData.data as Entitlement[]) || [];

    return data.issues.map((issue: any) => {
      let extractedEmail = '';
      let matchedRoleName = '';
      
      const findInObject = (obj: any) => {
        if (!obj) return;
        if (obj.emailAddress) extractedEmail = obj.emailAddress;
        const text = JSON.stringify(obj).toLowerCase();
        if (!extractedEmail) {
          const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (match) extractedEmail = match[0];
        }
        if (!matchedRoleName) {
          for (const ent of localEntitlements) {
            if (text.includes(ent.name.toLowerCase())) {
              matchedRoleName = ent.name;
              break;
            }
          }
        }
      };

      for (const key in issue.fields) findInObject(issue.fields[key]);

      return {
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        reporter: issue.fields.reporter?.displayName || 'Unbekannt',
        created: issue.fields.created,
        requestedUserEmail: extractedEmail || undefined,
        requestedRoleName: matchedRoleName || undefined
      };
    });
  } catch (e) {
    return [];
  }
}

/**
 * Schließt ein Jira Ticket ab.
 */
export async function resolveJiraTicket(configId: string, issueKey: string, comment: string): Promise<{ success: boolean; error?: string }> {
  const configs = await getJiraConfigs();
  const config = configs.find(c => c.id === configId);
  if (!config || !config.enabled) return { success: false };

  const url = cleanJiraUrl(config.url);
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

  try {
    await fetch(`${url}/rest/api/3/issue/${issueKey}/comment`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: comment }] }] } })
    });

    if (config.doneStatusName) {
      const transRes = await fetch(`${url}/rest/api/3/issue/${issueKey}/transitions`, {
        headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
      });
      if (transRes.ok) {
        const transData = await transRes.json();
        const target = transData.transitions?.find((t: any) => t.name.toLowerCase() === config.doneStatusName.toLowerCase());
        if (target) {
          await fetch(`${url}/rest/api/3/issue/${issueKey}/transitions`, {
            method: 'POST',
            headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ transition: { id: target.id } })
          });
        }
      }
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
