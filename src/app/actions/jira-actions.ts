
'use server';

import { getCollectionData } from './mysql-actions';
import { JiraConfig, JiraSyncItem } from '@/lib/types';

/**
 * Hilfsfunktion zum Bereinigen der Jira-URL.
 */
function cleanJiraUrl(url: string): string {
  if (!url) return '';
  let cleaned = url.trim().replace(/\/$/, '');
  if (cleaned.includes('/rest/api/')) {
    cleaned = cleaned.split('/rest/api/')[0];
  }
  return cleaned;
}

/**
 * Ruft die Jira-Konfiguration ab.
 */
export async function getJiraConfigs(): Promise<JiraConfig[]> {
  const result = await getCollectionData('jiraConfigs');
  return (result.data as JiraConfig[]) || [];
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
        details: `Jira-Antwort: ${errorText.substring(0, 300)}`
      };
    }

    const userData = await testRes.json();
    
    const jql = `project = "${configData.projectKey}" AND status = "${configData.approvedStatusName}"${configData.issueTypeName ? ` AND "Request Type" = "${configData.issueTypeName}"` : ''}`;
    
    const searchRes = await fetch(`${url}/rest/api/3/search/jql`, {
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
        message: `JQL Suche fehlgeschlagen (${searchRes.status})`,
        details: `Fehlermeldung: ${errorText.substring(0, 500)}`
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

    if (!response.ok) {
      console.error("[Jira Sync] API Error:", await response.text());
      return [];
    }

    const data = await response.json();
    if (!data.issues) return [];

    return data.issues.map((issue: any) => {
      let extractedEmail = '';
      
      const findEmailInText = (text: string): string | null => {
        if (!text || typeof text !== 'string') return null;
        const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        return match ? match[0] : null;
      };

      for (const fieldKey in issue.fields) {
        const fieldValue = issue.fields[fieldKey];
        if (fieldValue && typeof fieldValue === 'object' && fieldValue.emailAddress) {
          extractedEmail = fieldValue.emailAddress;
          break;
        }
        if (typeof fieldValue === 'string') {
          const found = findEmailInText(fieldValue);
          if (found) {
            extractedEmail = found;
            break;
          }
        }
      }

      if (!extractedEmail) {
        const description = issue.fields.description;
        const findEmailInADFNodes = (nodes: any[]): string | null => {
          if (!nodes || !Array.isArray(nodes)) return null;
          for (const node of nodes) {
            if (node.text) {
              const found = findEmailInText(node.text);
              if (found) return found;
            }
            if (node.content) {
              const found = findEmailInADFNodes(node.content);
              if (found) return found;
            }
          }
          return null;
        };

        if (description && description.content) {
          extractedEmail = findEmailInADFNodes(description.content) || '';
        }
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
    console.error("[Jira Sync] Critical Error:", e);
    return [];
  }
}

/**
 * Schließt ein Jira Ticket ab (Kommentar + Status-Transition).
 */
export async function resolveJiraTicket(configId: string, issueKey: string, comment: string): Promise<{ success: boolean; error?: string }> {
  const configs = await getJiraConfigs();
  const config = configs.find(c => c.id === configId);
  if (!config || !config.enabled) return { success: false, error: 'Jira nicht konfiguriert.' };

  const url = cleanJiraUrl(config.url);
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

  try {
    // 1. Kommentar hinzufügen
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

    // 2. Status-Transition durchführen (falls konfiguriert)
    if (config.doneStatusName) {
      // Transitionen abrufen
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
            headers: { 
              'Authorization': `Basic ${auth}`, 
              'Content-Type': 'application/json' 
            },
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
