
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
          issuetype: { name: 'Service Request' }
        }
      })
    });

    const data = await response.json();
    if (response.ok) {
      return { success: true, key: data.key };
    } else {
      console.error("[Jira Create Error]", data);
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
    const statusFilter = config.approvedStatusName || "Genehmigt";
    
    // JQL basierend auf User-Input: project = ITSM AND "Request Type" = "Anfragetyp" AND status = "Status"
    let jql = `project = "${config.projectKey}" AND status = "${statusFilter}"`;
    
    if (config.issueTypeName) {
      jql += ` AND "Request Type" = "${config.issueTypeName}"`;
    }
    
    jql += ` ORDER BY created DESC`;
    
    console.log(`[Jira Sync] Ausgeführte JQL: ${jql}`);

    const response = await fetch(`${config.url}/rest/api/3/search?jql=${encodeURIComponent(jql)}`, {
      headers: { 
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Jira API Error] Status ${response.status}: ${errorText}`);
      return [];
    }

    const data = await response.json();
    if (!data.issues) {
      console.log("[Jira Sync] Keine Issues im Search-Result gefunden.");
      return [];
    }

    return data.issues.map((issue: any) => {
      let extractedEmail = '';
      const description = issue.fields.description;

      const findEmailInNodes = (nodes: any[]): string | null => {
        if (!nodes) return null;
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
    
    await fetch(`${config.url}/rest/api/3/issue/${issueKey}/comment`, {
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
      })
    });

    return true;
  } catch (e) {
    return false;
  }
}
