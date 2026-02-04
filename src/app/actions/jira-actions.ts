
'use server';

import { getCollectionData } from './mysql-actions';
import { JiraConfig, JiraSyncItem, Resource, Entitlement, DataSource } from '@/lib/types';

/**
 * Hilfsfunktion zum Bereinigen der Jira-URL.
 */
function cleanJiraUrl(url: string): string {
  if (!url) return '';
  let cleaned = url.trim();
  
  // Stelle sicher, dass ein Protokoll vorhanden ist
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

  const url = cleanJiraUrl(configData.url!);
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
    
    const searchRes = await fetch(`${url}/rest/api/3/search`, {
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
export async function createJiraTicket(
  configId: string, 
  summary: string, 
  description: string, 
  dataSource: DataSource = 'mysql'
): Promise<{ success: boolean; key?: string; error?: string; details?: string }> {
  const configs = await getJiraConfigs(dataSource);
  const config = configs.find(c => c.id === configId);
  
  if (!config || !config.enabled) {
    console.error("Jira Ticket Fehler: Konfiguration nicht gefunden oder deaktiviert.", { configId, dataSource });
    return { success: false, error: 'Jira nicht konfiguriert oder deaktiviert.' };
  }

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
    
    if (!response.ok) {
      console.error("Jira API Response Fehler:", data);
      const errorMsg = data.errorMessages?.join(', ') || 'Unbekannter API Fehler';
      const fieldsErrors = data.errors ? JSON.stringify(data.errors) : '';
      return { 
        success: false, 
        error: `Jira API Fehler (${response.status})`, 
        details: `${errorMsg} ${fieldsErrors}`
      };
    }

    return { success: true, key: data.key };
  } catch (e: any) {
    console.error("Jira Netzwerkfehler:", e);
    return { success: false, error: 'Netzwerkfehler beim Jira-Aufruf', details: e.message };
  }
}

/**
 * Ruft Tickets ab, basierend auf ihrem Typ.
 */
export async function fetchJiraSyncItems(
  configId: string, 
  type: 'pending' | 'approved' | 'done',
  dataSource: DataSource = 'mysql'
): Promise<JiraSyncItem[]> {
  const configs = await getJiraConfigs(dataSource);
  const config = configs.find(c => c.id === configId);
  if (!config || !config.enabled) return [];

  const url = cleanJiraUrl(config.url);
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

  try {
    let jql = '';
    if (type === 'approved') {
      jql = `project = "${config.projectKey}" AND status = "${config.approvedStatusName}"`;
    } else if (type === 'done') {
      jql = `project = "${config.projectKey}" AND status = "${config.doneStatusName}"`;
    } else {
      jql = `project = "${config.projectKey}" AND status NOT IN ("${config.approvedStatusName}", "${config.doneStatusName}", "Canceled", "Rejected", "Abgelehnt")`;
    }

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

    if (!response.ok) return [];
    const data = await response.json();
    if (!data.issues) return [];

    return data.issues.map((issue: any) => {
      let extractedEmail = '';
      const findInObject = (obj: any) => {
        if (!obj) return;
        if (obj.emailAddress) extractedEmail = obj.emailAddress;
        if (!extractedEmail) {
          const text = JSON.stringify(obj).toLowerCase();
          const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (match) extractedEmail = match[0];
        }
      };
      for (const key in issue.fields) findInObject(issue.fields[key]);

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
    return [];
  }
}

/**
 * Schließt ein Jira Ticket ab.
 */
export async function resolveJiraTicket(
  configId: string, 
  issueKey: string, 
  comment: string,
  dataSource: DataSource = 'mysql'
): Promise<{ success: boolean; error?: string }> {
  const configs = await getJiraConfigs(dataSource);
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

export async function getJiraSchemasAction(configData: { 
  url: string; 
  email: string; 
  apiToken: string;
  workspaceId: string;
}): Promise<{ success: boolean; schemas?: any[]; error?: string }> {
  const baseUrl = cleanJiraUrl(configData.url);
  const auth = Buffer.from(`${configData.email}:${configData.apiToken}`).toString('base64');
  const apiUrl = `${baseUrl}/gateway/api/jsm/assets/workspace/${configData.workspaceId}/v1/objectschema/list`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) return { success: false, error: `Fehler ${response.status}` };
    const data = await response.json();
    return { success: true, schemas: data.values || [] };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function getJiraAttributesAction(configData: { 
  url: string; 
  email: string; 
  apiToken: string;
  workspaceId: string;
  objectTypeId: string;
  targetObjectTypeId?: string; 
}): Promise<{ 
  success: boolean; 
  attributes?: any[]; 
  labelAttributeId?: string; 
  referenceAttributeId?: string;
  error?: string 
}> {
  if (!configData.workspaceId || !configData.objectTypeId) {
    return { success: false, error: 'Workspace ID und Objekttyp ID erforderlich.' };
  }

  const baseUrl = cleanJiraUrl(configData.url);
  const auth = Buffer.from(`${configData.email}:${configData.apiToken}`).toString('base64');
  const apiUrl = `${baseUrl}/gateway/api/jsm/assets/workspace/${configData.workspaceId}/v1/objecttype/${configData.objectTypeId}/attributes`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) return { success: false, error: `Fehler ${response.status}` };

    const data = await response.json();
    const attributes = Array.isArray(data) ? data : (data.values || []);
    const labelAttr = attributes.find((a: any) => a.label === true || a.name?.toLowerCase() === 'name');
    
    let referenceAttributeId = undefined;
    if (configData.targetObjectTypeId) {
      const targetId = configData.targetObjectTypeId.toString();
      const refAttr = attributes.find((a: any) => {
        const isRefType = a.type === 7 || a.type === '7' || a.type === 'REFERENCED_OBJECT';
        const matchesTarget = a.typeValue?.toString() === targetId || a.additionalValue?.toString() === targetId;
        return isRefType && matchesTarget;
      });
      referenceAttributeId = refAttr?.id?.toString();
    }

    return { success: true, attributes, labelAttributeId: labelAttr?.id?.toString(), referenceAttributeId };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
