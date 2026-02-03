
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
 * Erstellt ein Ticket in Jira.
 */
export async function createJiraTicket(configId: string, summary: string, description: string): Promise<{ success: boolean; key?: string; error?: string }> {
  const configs = await getJiraConfigs();
  const config = configs.find(c => c.id === configId);

  if (!config || !config.enabled) return { success: false, error: 'Jira-Konfiguration nicht gefunden oder deaktiviert.' };

  try {
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    const response = await fetch(`${config.url}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
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
          issuetype: { name: config.issueTypeName || 'Task' }
        }
      })
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
    const statusFilter = config.approvedStatusName || "Done";
    const jql = `project = "${config.projectKey}" AND status = "${statusFilter}" ORDER BY created DESC`;
    const response = await fetch(`${config.url}/rest/api/3/search?jql=${encodeURIComponent(jql)}`, {
      headers: { 'Authorization': `Basic ${auth}` }
    });

    const data = await response.json();
    if (!data.issues) return [];

    return data.issues.map((issue: any) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      reporter: issue.fields.reporter?.displayName || 'Unbekannt',
      created: issue.fields.created,
      requestedUserEmail: issue.fields.description?.content?.[0]?.content?.[0]?.text?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0]
    }));
  } catch (e) {
    console.error("Jira Sync Error:", e);
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
    
    // Kommentar hinzufügen
    await fetch(`${config.url}/rest/api/3/issue/${issueKey}/comment`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: comment }] }] } })
    });

    return true;
  } catch (e) {
    return false;
  }
}
