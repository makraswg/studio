
export type Role = 'tenantOwner' | 'admin' | 'editor' | 'viewer' | 'superAdmin';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface User {
  id: string;
  externalId: string;
  displayName: string;
  email: string;
  department: string;
  title: string;
  enabled: boolean;
  lastSyncedAt: string;
}

export interface Resource {
  id: string;
  name: string;
  type: 'SaaS' | 'OnPrem' | 'Private Cloud' | 'Webshop' | 'IoT' | 'Andere';
  owner: string;
  url: string;
  documentationUrl?: string;
  criticality: 'low' | 'medium' | 'high';
  notes: string;
}

export interface Entitlement {
  id: string;
  resourceId: string;
  parentId?: string;
  name: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  isSharedAccount?: boolean;
  passwordManagerUrl?: string;
}

export interface Assignment {
  id: string;
  userId: string;
  entitlementId: string;
  originGroupId?: string;
  status: 'active' | 'requested' | 'removed';
  grantedBy: string;
  grantedAt: string;
  validFrom?: string;
  validUntil?: string;
  ticketRef: string;
  jiraIssueKey?: string;
  notes: string;
  lastReviewedAt?: string;
  reviewedBy?: string;
}

export interface AssignmentGroup {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  entitlementIds: string[];
  userIds: string[];
  validFrom?: string;
  validUntil?: string;
}

export interface JiraConfig {
  id: string;
  tenantId: string;
  name: string;
  url: string;
  email: string;
  apiToken: string;
  projectKey: string;
  issueTypeName: string;
  approvedStatusName: string;
  enabled: boolean;
}

export interface JiraSyncItem {
  key: string;
  summary: string;
  status: string;
  reporter: string;
  created: string;
  requestedUserEmail?: string;
  requestedRoleName?: string;
}
