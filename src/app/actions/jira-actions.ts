'use server';

import { getCollectionData } from './mysql-actions';
import { JiraConfig, JiraSyncItem, DataSource } from '@/lib/types';

/**
 * Hilfsfunktion zum Bereinigen der Jira-URL.
 */
function cleanJiraUrl(url: string): string {
  if (!url) return '';
  let cleaned = url.trim();
  
  if (!cleaned.startsWith('http')) {
    cleaned = 'https://' + cleaned;
  }
  
  try {
    const parsed = new URL(cleaned);
    return `${parsed.protocol}//${parsed.host}`;
  } catch (e) {
    cleaned = cleaned.replace(/\/$/, '');
    const segments = ['/rest/', '/jira/', '/assets/', '/browse/', '/projects/', '/gateway/'];
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
export async function getJiraConfigs(dataSource: DataSource = 'mysql'): Promise<JiraConfig[]> {
  const result = await getCollectionData('jiraConfigs', dataSource);
  return (result.data as JiraConfig[]) || [];
}

/**
 * Testet die Jira-Verbindung und liefert Informationen zum API-Token.
 */
export async function testJiraConnectionAction(configData: Partial<JiraConfig>): Promise<{ 
  success: boolean; 
  message: string; 
  details?: string;
}> {
  if (!configData.url || !configData.email || !configData.apiToken) {
    return { success: false, message: 'Unvollständige Zugangsdaten.' };
  }

  const url = cleanJiraUrl(configData.url!);
  const auth = Buffer.from(`${configData.email}:${configData.apiToken}`).toString('base64');

  try {
    const testRes = await fetch(`${url}/rest/api/3/myself`, {
      headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
      cache: 'no-store'
    });

    if (!testRes.ok) {
      const status = testRes.status;
      if (status === 401) return { success: false, message: 'Authentifizierungsfehler (401)', details: "E-Mail oder API-Token ungültig." };
      if (status === 403) return { success: false, message: 'Zugriff verweigert (403)', details: "Der Token hat nicht die benötigten Berechtigungen." };
      return { success: false, message: `Jira antwortet mit Status ${status}` };
    }

    const userData = await testRes.json();
    return { 
      success: true, 
      message: `Verbunden als ${userData.displayName}.`,
      details: `API-Token ist gültig. Zugriffsebene: ${userData.accountType}`
    };
  } catch (e: any) {
    return { success: false, message: `Verbindungsfehler: ${e.message}` };
  }
}

/**
 * Ruft alle Projekte aus Jira ab.
 */
export async function getJiraProjectsAction(configData: Partial<JiraConfig>): Promise<{ success: boolean; projects?: any[]; error?: string }> {
  if (!configData.url || !configData.apiToken) return { success: false, error: 'Keine Zugangsdaten' };
  const url = cleanJiraUrl(configData.url!);
  const auth = Buffer.from(`${configData.email}:${configData.apiToken}`).toString('base64');

  try {
    const response = await fetch(`${url}/rest/api/3/project`, {
      headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) return { success: false, error: `Jira API Fehler ${response.status}` };
    const projects = await response.json();
    return { success: true, projects: Array.isArray(projects) ? projects : [] };
  } catch (e: any) { return { success: false, error: e.message }; }
}

/**
 * Ruft Metadaten (Vorgangstypen und Status) für ein Projekt ab.
 */
export async function getJiraProjectMetadataAction(configData: Partial<JiraConfig>, projectKey: string): Promise<{ 
  success: boolean; 
  issueTypes?: any[]; 
  statuses?: any[];
  error?: string 
}> {
  if (!configData.url || !configData.apiToken || !projectKey) return { success: false, error: 'Keine Projektdaten' };
  const url = cleanJiraUrl(configData.url!);
  const auth = Buffer.from(`${configData.email}:${configData.apiToken}`).toString('base64');

  try {
    // 1. Issue Types
    const itRes = await fetch(`${url}/rest/api/3/project/${projectKey}`, {
      headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
      cache: 'no-store'
    });
    
    if (!itRes.ok) throw new Error(`Projekt-Metadaten Fehler ${itRes.status}`);
    const projectData = await itRes.json();
    const issueTypes = projectData.issueTypes || [];

    // 2. Statuses
    const stRes = await fetch(`${url}/rest/api/3/project/${projectKey}/statuses`, {
      headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
      cache: 'no-store'
    });
    
    if (!stRes.ok) throw new Error(`Status-Metadaten Fehler ${stRes.status}`);
    const statusGroups = await stRes.json();
    const allStatuses = statusGroups.flatMap((g: any) => g.statuses || []);

    return { success: true, issueTypes, statuses: allStatuses };
  } catch (e: any) { return { success: false, error: e.message }; }
}

/**
 * Assets Discovery: Ruft Workspaces ab.
 */
export async function getJiraWorkspacesAction(configData: Partial<JiraConfig>): Promise<{ success: boolean; workspaces?: any[]; error?: string }> {
  if (!configData.url || !configData.apiToken) return { success: false, error: 'Keine Zugangsdaten' };
  const url = cleanJiraUrl(configData.url!);
  const auth = Buffer.from(`${configData.email}:${configData.apiToken}`).toString('base64');

  try {
    const response = await fetch(`${url}/rest/servicedeskapi/assets/workspace`, {
      headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      if (response.status === 404) return { success: false, error: "Assets API nicht erreichbar. Prüfen Sie, ob JSM Assets aktiviert ist." };
      return { success: false, error: `Assets API Fehler ${response.status}` };
    }
    
    const data = await response.json();
    const rawValues = data.values || (Array.isArray(data) ? data : []);
    
    const workspaces = rawValues.map((w: any) => ({
      id: w.workspaceId || w.id,
      name: w.name || 'Standard Workspace'
    }));

    return { success: true, workspaces };
  } catch (e: any) { return { success: false, error: e.message }; }
}

/**
 * Assets Discovery: Ruft Schemas für einen Workspace ab.
 */
export async function getJiraSchemasAction(configData: Partial<JiraConfig>, workspaceId: string): Promise<{ success: boolean; schemas?: any[]; error?: string }> {
  if (!configData.url || !configData.apiToken || !workspaceId) return { success: false, error: 'Keine Workspace-Daten' };
  const url = cleanJiraUrl(configData.url!);
  const auth = Buffer.from(`${configData.email}:${configData.apiToken}`).toString('base64');
  
  try {
    const response = await fetch(`${url}/gateway/api/jsm/assets/workspace/${workspaceId}/v1/objectschema/list`, {
      headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
      cache: 'no-store'
    });
    
    if (!response.ok) return { success: false, error: `Schema API Fehler ${response.status}` };
    const data = await response.json();
    return { success: true, schemas: data.values || [] };
  } catch (e: any) { return { success: false, error: e.message }; }
}

/**
 * Assets Discovery: Ruft Objekttypen für ein Schema ab.
 */
export async function getJiraObjectTypesAction(configData: Partial<JiraConfig>, workspaceId: string, schemaId: string): Promise<{ success: boolean; objectTypes?: any[]; error?: string }> {
  if (!configData.url || !configData.apiToken || !workspaceId || !schemaId) return { success: false, error: 'Keine Schema-Daten' };
  const url = cleanJiraUrl(configData.url!);
  const auth = Buffer.from(`${configData.email}:${configData.apiToken}`).toString('base64');

  try {
    const response = await fetch(`${url}/gateway/api/jsm/assets/workspace/${workspaceId}/v1/objectschema/${schemaId}/objecttypes/flat`, {
      headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
      cache: 'no-store'
    });
    
    if (!response.ok) return { success: false, error: `ObjectType API Fehler ${response.status}` };
    const data = await response.json();
    return { success: true, objectTypes: Array.isArray(data) ? data : (data.values || []) };
  } catch (e: any) { return { success: false, error: e.message }; }
}

/**
 * Erstellt ein Ticket in Jira Cloud.
 */
export async function createJiraTicket(
  configId: string, 
  summary: string, 
  description: string, 
  dataSource: DataSource = 'mysql'
): Promise<{ success: boolean; key?: string; error?: string }> {
  const configs = await getJiraConfigs(dataSource);
  const config = configs.find(c => c.id === configId);
  if (!config || !config.enabled) return { success: false, error: 'Jira nicht aktiv' };

  const url = cleanJiraUrl(config.url);
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

  const descriptionContent = description.split('\n').map(line => ({
    type: 'paragraph',
    content: [{ type: 'text', text: line || ' ' }]
  }));

  try {
    const payload = {
      fields: {
        project: { key: config.projectKey },
        summary: summary.substring(0, 250),
        description: { type: 'doc', version: 1, content: descriptionContent },
        issuetype: { name: config.issueTypeName || 'Task' }
      }
    };

    const response = await fetch(`${url}/rest/api/3/issue`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });

    const data = await response.json();
    if (!response.ok) return { success: false, error: `Jira API Fehler: ${JSON.stringify(data.errors)}` };
    return { success: true, key: data.key };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export type JiraSyncResponse = {
  success: boolean;
  items: JiraSyncItem[];
  error?: string;
};

/**
 * Ruft Tickets basierend auf Status-Mapping ab.
 */
export async function fetchJiraSyncItems(
  configId: string, 
  type: 'pending' | 'approved' | 'done',
  dataSource: DataSource = 'mysql'
): Promise<JiraSyncResponse> {
  const configs = await getJiraConfigs(dataSource);
  const config = configs.find(c => c.id === configId);
  if (!config || !config.enabled || !config.projectKey) return { success: false, items: [] };

  const url = cleanJiraUrl(config.url);
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

  try {
    let jql = `project = "${config.projectKey}"`;
    const approvedStatus = config.approvedStatusName || 'Approved';
    const doneStatus = config.doneStatusName || 'Done';

    if (type === 'approved') jql += ` AND status = "${approvedStatus}"`;
    else if (type === 'done') jql += ` AND status = "${doneStatus}"`;
    else jql += ` AND status NOT IN ("${approvedStatus}", "${doneStatus}", "Canceled", "Rejected")`;

    jql += ' ORDER BY created DESC';

    const response = await fetch(`${url}/rest/api/3/search/jql`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jql, maxResults: 100, fields: ["summary", "status", "reporter", "created", "description"] }),
      cache: 'no-store'
    });

    const data = await response.json();
    if (!response.ok) return { success: false, items: [], error: 'JQL Fehler' };

    const items = (data.issues || []).map((issue: any) => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      reporter: issue.fields.reporter?.displayName || 'Unbekannt',
      created: issue.fields.created,
      requestedUserEmail: JSON.stringify(issue.fields.description)?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0]
    }));

    return { success: true, items };
  } catch (e: any) { return { success: false, items: [], error: e.message }; }
}

/**
 * Schließt ein Jira Ticket ab.
 */
export async function resolveJiraTicket(
  configId: string, 
  issueKey: string, 
  comment: string,
  dataSource: DataSource = 'mysql'
): Promise<{ success: boolean }> {
  const configs = await getJiraConfigs(dataSource);
  const config = configs.find(c => c.id === configId);
  if (!config || !config.enabled) return { success: false };

  const url = cleanJiraUrl(config.url);
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

  try {
    await fetch(`${url}/rest/api/3/issue/${issueKey}/comment`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: comment }] }] } 
      })
    });

    if (config.doneStatusName) {
      const transRes = await fetch(`${url}/rest/api/3/issue/${issueKey}/transitions`, {
        headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
      });
      if (transRes.ok) {
        const transData = await transRes.json();
        const target = transData?.transitions?.find((t: any) => t.name.toLowerCase() === config.doneStatusName!.toLowerCase());
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
  } catch (e: any) { return { success: false }; }
}
