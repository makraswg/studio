'use server';

import { getCollectionData } from './mysql-actions';
import { JiraConfig, JiraSyncItem, Resource, Entitlement, DataSource } from '@/lib/types';

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
 * Testet die Jira-Verbindung und ruft verfügbare Vorgangstypen ab.
 */
export async function testJiraConnectionAction(configData: Partial<JiraConfig>): Promise<{ 
  success: boolean; 
  message: string; 
  details?: string;
  count?: number;
  availableTypes?: string[];
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
      const errorBody = await testRes.text();
      return { success: false, message: `Authentifizierungsfehler (${testRes.status})`, details: errorBody };
    }

    const userData = await testRes.json();
    let availableTypes: string[] = [];

    if (configData.projectKey) {
      const projectRes = await fetch(`${url}/rest/api/3/project/${configData.projectKey}`, {
        headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (projectRes.ok) {
        const projectData = await projectRes.json();
        if (projectData && projectData.issueTypes) {
          availableTypes = projectData.issueTypes
            .filter((t: any) => !t.subtask)
            .map((t: any) => t.name);
        }
      }
    }

    return { 
      success: true, 
      message: `Verbunden als ${userData.displayName}.`,
      availableTypes: availableTypes.length > 0 ? availableTypes : undefined
    };
  } catch (e: any) {
    return { success: false, message: `Verbindungsfehler: ${e.message}` };
  }
}

/**
 * Erstellt ein Ticket in Jira Cloud mit Unterstützung für strukturierte ADF-Beschreibungen.
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
    return { success: false, error: 'Jira nicht konfiguriert oder deaktiviert.' };
  }

  const url = cleanJiraUrl(config.url);
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

  const safeSummary = summary.substring(0, 250);
  const issueTypeName = (config.issueTypeName || 'Task').trim();

  // Konvertiert die Beschreibung in das Atlassian Document Format (ADF)
  const descriptionContent = description.split('\n').map(line => ({
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: line || ' '
      }
    ]
  }));

  try {
    const payload = {
      fields: {
        project: { key: config.projectKey },
        summary: safeSummary,
        description: {
          type: 'doc',
          version: 1,
          content: descriptionContent
        },
        issuetype: { name: issueTypeName }
      }
    };

    const response = await fetch(`${url}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });

    const data = await response.json();
    
    if (!response.ok) {
      let detailedErrors = '';
      if (data.errorMessages && data.errorMessages.length > 0) {
        detailedErrors = data.errorMessages.join('. ');
      }
      if (data.errors) {
        const fieldErrors = Object.entries(data.errors)
          .map(([field, msg]) => `${field}: ${msg}`)
          .join('; ');
        detailedErrors = detailedErrors ? `${detailedErrors}. ${fieldErrors}` : fieldErrors;
      }
      return { 
        success: false, 
        error: detailedErrors || `Jira API Fehler (${response.status})`,
        details: JSON.stringify(data)
      };
    }

    return { success: true, key: data.key };
  } catch (e: any) {
    return { success: false, error: 'Netzwerkfehler zum Jira Server', details: e.message };
  }
}

export type JiraSyncResponse = {
  success: boolean;
  items: JiraSyncItem[];
  error?: string;
  details?: string;
};

/**
 * Ruft Tickets ab, basierend auf ihrem Typ.
 * Nutzt den neuen /rest/api/3/search/jql Endpunkt.
 */
export async function fetchJiraSyncItems(
  configId: string, 
  type: 'pending' | 'approved' | 'done',
  dataSource: DataSource = 'mysql'
): Promise<JiraSyncResponse> {
  const configs = await getJiraConfigs(dataSource);
  const config = configs.find(c => c.id === configId);
  if (!config || !config.enabled || !config.projectKey) {
    return { success: false, items: [], error: 'Konfiguration unvollständig oder Projekt-Key fehlt.' };
  }

  const url = cleanJiraUrl(config.url);
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

  try {
    let jql = `project = "${config.projectKey}"`;
    const approvedStatus = config.approvedStatusName || 'Approved';
    const doneStatus = config.doneStatusName || 'Done';

    if (type === 'approved') {
      jql += ` AND status = "${approvedStatus}"`;
    } else if (type === 'done') {
      jql += ` AND status = "${doneStatus}"`;
    } else {
      // Pending: Alles was nicht Approved oder Done (oder explizit abgelehnt) ist
      const excludeStatus = [approvedStatus, doneStatus, "Canceled", "Rejected", "Abgelehnt", "Storniert"]
        .filter(s => !!s)
        .map(s => `"${s}"`)
        .join(', ');
      
      if (excludeStatus) {
        jql += ` AND status NOT IN (${excludeStatus})`;
      }
    }

    jql += ' ORDER BY created DESC';

    const response = await fetch(`${url}/rest/api/3/search/jql`, {
      method: 'POST',
      headers: { 
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        jql: jql,
        maxResults: 100,
        fields: ["summary", "status", "reporter", "created", "description"]
      }),
      cache: 'no-store'
    });

    const data = await response.json();

    if (!response.ok) {
      return { 
        success: false, 
        items: [], 
        error: `Jira API Fehler (${response.status})`, 
        details: JSON.stringify(data)
      };
    }

    if (!data.issues) return { success: true, items: [] };

    const items = data.issues.map((issue: any) => {
      let extractedEmail = '';
      
      const findInObject = (obj: any) => {
        if (!obj) return;
        if (obj.emailAddress) extractedEmail = obj.emailAddress;
        if (!extractedEmail) {
          const text = typeof obj === 'string' ? obj : JSON.stringify(obj).toLowerCase();
          const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (match) extractedEmail = match[0];
        }
      };
      
      for (const key in issue.fields) {
        findInObject(issue.fields[key]);
        if (extractedEmail) break;
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

    return { success: true, items };
  } catch (e: any) {
    console.error("fetchJiraSyncItems error:", e);
    return { success: false, items: [], error: 'Netzwerkfehler', details: e.message };
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
      body: JSON.stringify({ 
        body: { 
          type: 'doc', 
          version: 1, 
          content: [
            { 
              type: 'paragraph', 
              content: [{ type: 'text', text: comment }] 
            }
          ] 
        } 
      })
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
      headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
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

export async function getJiraObjectTypesAction(configData: {
  url: string;
  email: string;
  apiToken: string;
  workspaceId: string;
  schemaId: string;
}): Promise<{ success: boolean; objectTypes?: any[]; error?: string }> {
  const baseUrl = cleanJiraUrl(configData.url);
  const auth = Buffer.from(`${configData.email}:${configData.apiToken}`).toString('base64');
  const apiUrl = `${baseUrl}/gateway/api/jsm/assets/workspace/${configData.workspaceId}/v1/objectschema/${configData.schemaId}/objecttypes/flat`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) return { success: false, error: `Fehler ${response.status}` };
    const data = await response.json();
    return { success: true, objectTypes: data || [] };
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
