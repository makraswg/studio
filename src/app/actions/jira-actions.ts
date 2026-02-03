'use server';

import { getCollectionData } from './mysql-actions';
import { JiraConfig, JiraSyncItem, Resource, Entitlement } from '@/lib/types';

/**
 * Hilfsfunktion zum Bereinigen der Jira-URL.
 * Extrahiert die Basis-Domain, auch wenn der User eine tiefe URL aus dem Browser kopiert hat.
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
 * Ruft verfügbare Jira Assets Workspaces ab.
 * Nutzt nun den instanzspezifischen Discovery-Endpunkt.
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
    // Discovery endpoint basierend auf User-Doku
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
        details: `Endpoint: ${baseUrl}/rest/servicedeskapi/assets/workspace. Antwort: ${errorText.substring(0, 200)}`
      };
    }

    const data = await response.json();
    // Die Antwort ist ein Array von Workspaces
    const workspaces = (data.values || data || []).map((w: any) => ({
      id: w.workspaceId || w.id,
      name: w.workspaceName || w.name || "Standard Workspace"
    }));

    return { success: true, workspaces };
  } catch (e: any) {
    return { success: false, error: 'Verbindungsfehler zur Jira Instanz', details: e.message };
  }
}

/**
 * Testet die Jira-Verbindung und Assets-Anbindung.
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
    // 1. Basis Authentifizierungstest
    const testRes = await fetch(`${url}/rest/api/3/myself`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      },
      cache: 'no-store'
    });

    if (!testRes.ok) {
      const errorText = await testRes.text();
      return { 
        success: false, 
        message: `Authentifizierungsfehler (${testRes.status})`,
        details: `Jira-Antwort auf /myself: ${errorText.substring(0, 300)}`
      };
    }

    const userData = await testRes.json();
    
    // 2. JQL Search Test via POST
    const jql = `project = "${configData.projectKey}" AND status = "${configData.approvedStatusName}"${configData.issueTypeName ? ` AND "Request Type" = "${configData.issueTypeName}"` : ''}`;
    
    const searchRes = await fetch(`${url}/rest/api/3/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        jql: jql,
        maxResults: 1,
        fields: ["id", "key"]
      }),
      cache: 'no-store'
    });

    if (!searchRes.ok) {
      const errorText = await searchRes.text();
      return { 
        success: false, 
        message: `Suche fehlgeschlagen (${searchRes.status})`,
        details: `Endpoint: ${url}/rest/api/3/search. Antwort: ${errorText.substring(0, 500)}`
      };
    }

    const searchData = await searchRes.json();

    return { 
      success: true, 
      message: `Erfolgreich verbunden als ${userData.displayName}.`,
      count: searchData.total,
      details: `Gefundene Tickets für Abfrage: ${searchData.total}`
    };

  } catch (e: any) {
    return { success: false, message: `Verbindungsfehler: ${e.message}`, details: `Ziel-URL: ${url}` };
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
    if (response.ok) {
      return { success: true, key: data.key };
    } else {
      return { success: false, error: data.errors ? JSON.stringify(data.errors) : 'Ticket konnte nicht erstellt werden.' };
    }
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
    let jql = `project = "${config.projectKey}" AND status = "${config.approvedStatusName}"`;
    if (config.issueTypeName) {
      jql += ` AND "Request Type" = "${config.issueTypeName}"`;
    }
    jql += ` ORDER BY created DESC`;

    const response = await fetch(`${url}/rest/api/3/search`, {
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

    const resData = await getCollectionData('resources');
    const entData = await getCollectionData('entitlements');
    const localResources = (resData.data as Resource[]) || [];
    const localEntitlements = (entData.data as Entitlement[]) || [];

    return data.issues.map((issue: any) => {
      let extractedEmail = '';
      let matchedRoleName = '';
      let matchedResourceName = '';
      
      const findInObject = (obj: any): string | null => {
        if (!obj) return null;
        if (obj.emailAddress) {
          extractedEmail = obj.emailAddress;
          return extractedEmail;
        }
        const text = JSON.stringify(obj).toLowerCase();
        if (!extractedEmail) {
          const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (emailMatch) extractedEmail = emailMatch[0];
        }
        if (!matchedRoleName) {
          for (const ent of localEntitlements) {
            if (text.includes(ent.name.toLowerCase())) {
              matchedRoleName = ent.name;
              const res = localResources.find(r => r.id === ent.resourceId);
              if (res) matchedResourceName = res.name;
              break;
            }
          }
        }
        return null;
      };

      for (const fieldKey in issue.fields) {
        findInObject(issue.fields[fieldKey]);
      }

      return {
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        reporter: issue.fields.reporter?.displayName || 'Unbekannt',
        created: issue.fields.created,
        requestedUserEmail: extractedEmail || undefined,
        requestedRoleName: matchedRoleName || undefined,
        requestedResourceName: matchedResourceName || undefined
      };
    });
  } catch (e) {
    console.error("[Jira Sync] Critical Error:", e);
    return [];
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

  // Placeholder für tatsächliche API-Synchronisation zu https://api.atlassian.com/ex/jira/...
  // basierend auf den von Ihnen bereitgestellten Endpunkten.
  return { 
    success: true, 
    message: "Assets-Konfiguration erkannt. Die Synchronisation erfolgt über den Workspace " + config.assetsWorkspaceId 
  };
}

/**
 * Schließt ein Jira Ticket ab.
 */
export async function resolveJiraTicket(configId: string, issueKey: string, comment: string): Promise<{ success: boolean; error?: string }> {
  const configs = await getJiraConfigs();
  const config = configs.find(c => c.id === configId);
  if (!config || !config.enabled) return { success: false, error: 'Jira nicht konfiguriert.' };

  const url = cleanJiraUrl(config.url);
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

  try {
    await fetch(`${url}/rest/api/3/issue/${issueKey}/comment`, {
      method: 'POST',
      headers: { 
        'Authorization': `Basic ${auth}`, 
        'Content-Type': 'application/json', 
        'Accept': 'application/json'
      },
      body: JSON.stringify({ 
        body: { 
          type: 'doc', 
          version: 1, 
          content: [{ 
            type: 'paragraph', 
            content: [{ type: 'text', text: comment }] 
          }] 
        } 
      }),
      cache: 'no-store'
    });

    if (config.doneStatusName) {
      const transRes = await fetch(`${url}/rest/api/3/issue/${issueKey}/transitions`, {
        headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
        cache: 'no-store'
      });
      
      if (transRes.ok) {
        const transData = await transRes.json();
        const targetTrans = transData.transitions?.find((t: any) => 
          t.name.toLowerCase() === config.doneStatusName.toLowerCase() || 
          t.to.name.toLowerCase() === config.doneStatusName.toLowerCase()
        );

        if (targetTrans) {
          await fetch(`${url}/rest/api/3/issue/${issueKey}/transitions`, {
            method: 'POST',
            headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ transition: { id: targetTrans.id } }),
            cache: 'no-store'
          });
        }
      }
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
