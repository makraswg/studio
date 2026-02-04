
export type Role = 'tenantOwner' | 'admin' | 'editor' | 'viewer' | 'superAdmin';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  // LDAP Configuration
  ldapEnabled?: boolean | number;
  ldapUrl?: string;
  ldapPort?: string;
  ldapBaseDn?: string;
  ldapBindDn?: string;
  ldapBindPassword?: string;
  ldapUserFilter?: string;
}

export interface User {
  id: string;
  tenantId: string;
  externalId: string;
  displayName: string;
  email: string;
  department: string;
  title: string;
  enabled: boolean | number;
  onboardingDate?: string;
  offboardingDate?: string;
  lastSyncedAt: string;
}

export interface Resource {
  id: string;
  tenantId: string;
  name: string;
  type: 'SaaS' | 'OnPrem' | 'Private Cloud' | 'Webshop' | 'IoT' | 'Andere';
  owner: string;
  url: string;
  documentationUrl?: string;
  criticality: 'low' | 'medium' | 'high';
  notes: string;
  createdAt?: string;
}

export interface Entitlement {
  id: string;
  resourceId: string;
  parentId?: string;
  name: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  isAdmin?: boolean | number;
  isSharedAccount?: boolean | number;
  passwordManagerUrl?: string;
  tenantId?: string;
}

export interface Assignment {
  id: string;
  userId: string;
  entitlementId: string;
  originGroupId?: string;
  status: 'active' | 'requested' | 'removed' | 'pending_removal';
  grantedBy: string;
  grantedAt: string;
  validFrom?: string;
  validUntil?: string;
  ticketRef: string;
  jiraIssueKey?: string;
  notes: string;
  lastReviewedAt?: string;
  reviewedBy?: string;
  tenantId?: string;
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

export interface Bundle {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  entitlementIds: string[];
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
  doneStatusName: string;
  enabled: boolean;
  // Assets Config
  assetsWorkspaceId?: string;
  assetsSchemaId?: string;
  assetsResourceObjectTypeId?: string;
  assetsRoleObjectTypeId?: string;
  assetsResourceNameAttributeId?: string;
  assetsRoleNameAttributeId?: string;
  assetsSystemAttributeId?: string;
}

export interface JiraSyncItem {
  key: string;
  summary: string;
  status: string;
  reporter: string;
  created: string;
  requestedUserEmail?: string;
  requestedRoleName?: string;
  requestedResourceName?: string;
}
