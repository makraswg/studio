'use server';

import { getCollectionData } from './mysql-actions';
import { JiraConfig, JiraSyncItem } from '@/lib/types';

/**
 * Ruft die Jira-Konfiguration ab.
 */
export async function getJiraConfigs(): Promise<JiraConfig[]> {
  const result = await getCollectionData('jiraConfigs');
  return (result.data as JiraConfig[]) || [];
}

/**
 * Testet die Jira-Verbindung und gibt detaillierte Diagnose-Informationen zurück.
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

  try {
    const auth = Buffer.from(`${configData.email}:${configData.apiToken}`).toString('base64');
    const url = configData.url.replace(/\/$/, ''); // Remove trailing slash
    
    // 1. Einfacher Ping an /myself
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
        message: `HTTP Fehler ${testRes.status}: ${testRes.statusText}`,
        details: errorText.substring(0, 200)
      };
    }

    const userData = await testRes.json();
    
    // 2. Test-Suche mit POST (Moderner Standard)
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
        success: true, 
        message: `Verbindung ok (User: ${userData.displayName}), aber JQL-Suche schlug fehl.`,
        details: `JQL Fehler: ${errorText.substring(0, 200)}`
      };
    }

    const searchData = await searchRes.json();
    return { 
      success: true, 
      message: `Erfolgreich verbunden als ${userData.displayName}.`,
      count: searchData.total,
      details: `Die JQL-Abfrage liefert aktuell ${searchData.total} Tickets zurück.`
    };

  } catch (e: any) {
    return { success: false, message: `Systemfehler: ${e.message}` };
  }
}

/**
 * Erstellt ein Ticket in Jira.
 */
export async function createJiraTicket(configId: string, summary: string, description: string): Promise<{ success: boolean; key?: string; error?: string }> {
  const configs = await getJiraConfigs();
  const config = configs.find(c => c.id === configId);

  if (!config || !config.enabled) return { success: false, error: 'Jira-Konfiguration nicht gefunden oder deaktiviert.' };

  try {
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    const url = config.url.replace(/\/$/, '');
    
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
      return { success: false, error: data.errors ? JSON.stringify(data.errors) : 'Unbekannter Jira-Fehler' };
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

  try {
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    const url = config.url.replace(/\/$/, '');
    
    // JQL Filterung
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
        fields: ["summary", "status", "reporter", "created", "description"]
      }),
      cache: 'no-store'
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[Jira Sync API Error]:", err);
      return [];
    }

    const data = await response.json();
    if (!data.issues) return [];

    return data.issues.map((issue: any) => {
      let extractedEmail = '';
      const description = issue.fields.description;

      const findEmailInNodes = (nodes: any[]): string | null => {
        if (!nodes || !Array.isArray(nodes)) return null;
        for (const node of nodes) {
          if (node.text) {
            const match = node.text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (match) return match[0];
          }
          if (node.content) {
            const found = findEmailInNodes(node.content);
            if (found) return found;
          }
        }
        return null;
      };

      if (description && description.content) {
        extractedEmail = findEmailInNodes(description.content) || '';
      }

      return {
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        reporter: issue.fields.reporter?.displayName || 'Unbekannt',
        created: issue.fields.created,
        requestedUserEmail: extractedEmail || undefined
      };
    });
  } catch (e) {
    console.error("[Jira Sync Critical Error]:", e);
    return [];
  }
}

/**
 * Kommentiert und schließt ein Jira Ticket.
 */
export async function resolveJiraTicket(configId: string, issueKey: string, comment: string): Promise<boolean> {
  const configs = await getJiraConfigs();
  const config = configs.find(c => c.id === configId);
  if (!config) return false;

  try {
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    const url = config.url.replace(/\/$/, '');
    
    await fetch(`${url}/rest/api/3/issue/${issueKey}/comment`, {
      method: 'POST',
      headers: { 
        'Authorization': `Basic ${auth}`, 
        'Content-Type': 'application/json' 
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

    return true;
  } catch (e) {
    return false;
  }
}
