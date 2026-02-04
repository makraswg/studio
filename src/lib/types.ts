
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
  adGroups?: string[];
}

export interface PlatformUser {
  id: string;
  uid?: string; // Firebase Auth UID
  email: string;
  password?: string; // Password field for initial setup or prototype storage
  displayName: string;
  role: Role;
  tenantId: string; // 'all' or specific tenantId
  enabled: boolean | number;
  createdAt: string;
}

export interface ServicePartner {
  id: string;
  tenantId: string;
  name: string; // Company Name
  contactPerson: string;
  email: string;
  phone?: string;
}

export interface Resource {
  id: string;
  tenantId: string;
  name: string;
  category: 'it_tool' | 'business_critical' | 'test' | 'standard_app' | 'infrastructure';
  type: 'SaaS' | 'OnPrem' | 'Private Cloud' | 'Webshop' | 'IoT' | 'Andere';
  operatorId: string; // Reference to ServicePartner
  dataClassification: 'public' | 'internal' | 'confidential' | 'strictly_confidential';
  dataLocation: string;
  mfaType: 'none' | 'standard_otp' | 'standard_mail' | 'optional_otp' | 'optional_mail';
  authMethod: 'direct' | string; // 'direct' or ID of another resource (SSO)
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
  externalMapping?: string;
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
  syncSource?: 'manual' | 'ldap' | 'group';
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
  apiTokenExpiresAt?: string;
  projectKey: string;
  issueTypeName: string;
  approvedStatusName: string;
  doneStatusName: string;
  enabled: boolean;
  assetsWorkspaceId?: string;
  assetsSchemaId?: string;
  assetsResourceObjectTypeId?: string;
  assetsRoleObjectTypeId?: string;
  assetsResourceNameAttributeId?: string;
  assetsRoleNameAttributeId?: string;
  assetsSystemAttributeId?: string;
}

export interface SmtpConfig {
  id: string;
  host: string;
  port: string;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  encryption: 'none' | 'ssl' | 'tls';
  enabled: boolean | number;
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

export interface Document {
  id: string;
  [key: string]: any;
}
