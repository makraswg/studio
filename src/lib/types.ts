
export type Role = 'tenantOwner' | 'admin' | 'editor' | 'viewer' | 'superAdmin';
export type DataSource = 'firestore' | 'mock' | 'mysql';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
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
  uid?: string;
  email: string;
  password?: string;
  displayName: string;
  role: Role;
  tenantId: string;
  enabled: boolean | number;
  createdAt: string;
}

export interface Resource {
  id: string;
  tenantId: string;
  name: string;
  category: 'it_tool' | 'business_critical' | 'test' | 'standard_app' | 'infrastructure';
  type: 'SaaS' | 'OnPrem' | 'Private Cloud' | 'Webshop' | 'IoT' | 'Andere';
  operatorId: string;
  dataClassification: 'public' | 'internal' | 'confidential' | 'strictly_confidential';
  dataLocation: string;
  mfaType: 'none' | 'standard_otp' | 'standard_mail' | 'optional_otp' | 'optional_mail';
  authMethod: 'direct' | string;
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

export interface JiraConfig {
  id: string;
  enabled: boolean;
  url: string;
  email: string;
  apiToken: string;
  projectKey: string;
  issueTypeName?: string;
  approvedStatusName?: string;
  doneStatusName?: string;
  // Assets Sync Configuration
  workspaceId?: string;
  schemaId?: string;
  resourceObjectTypeId?: string;
  entitlementObjectTypeId?: string;
  resourceLabelAttrId?: string;
  entitlementLabelAttrId?: string;
  resourceToEntitlementAttrId?: string;
  autoSyncAssets?: boolean;
}

export interface SmtpConfig {
  id: string;
  enabled: boolean;
  host: string;
  port: string;
  user: string;
  password?: string;
  fromEmail: string;
}

export interface AiConfig {
  id: string;
  enabled: boolean;
  provider: 'ollama' | 'google';
  ollamaUrl?: string;
  ollamaModel?: string;
  geminiModel?: string;
  enabledForAdvisor?: boolean;
}

export interface SyncJob {
  id: string;
  name: string;
  lastRun?: string;
  lastStatus?: 'success' | 'error' | 'running';
  lastMessage?: string;
}

// Catalog System
export interface Catalog {
  id: string;
  name: string;
  version: string;
  provider: string; // e.g. BSI
  importedAt: string;
}

export interface HazardModule {
  id: string;
  catalogId: string;
  code: string; // e.g. ORP, APP
  title: string;
}

export interface Hazard {
  id: string;
  moduleId: string;
  code: string; // e.g. APP.1
  title: string;
  description: string;
  contentHash: string;
}

export interface ImportRun {
  id: string;
  catalogId: string;
  timestamp: string;
  status: 'success' | 'partial' | 'failed';
  itemCount: number;
  log: string;
}

export interface ImportIssue {
  id: string;
  runId: string;
  severity: 'warning' | 'error';
  itemRef: string;
  message: string;
}

export interface Risk {
  id: string;
  tenantId: string;
  assetId?: string;
  hazardId?: string;
  title: string;
  category: string;
  description: string;
  impact: number;
  probability: number;
  residualImpact?: number;
  residualProbability?: number;
  owner: string;
  status: 'active' | 'mitigated' | 'accepted' | 'closed';
  acceptanceStatus?: 'pending' | 'accepted' | 'rejected';
  acceptanceReason?: string;
  acceptedBy?: string;
  lastReviewDate?: string;
  reviewCycleDays?: number;
  createdAt: string;
}

export interface RiskCategorySetting {
  id: string;
  tenantId: string;
  defaultReviewDays: number;
}

export interface RiskMeasure {
  id: string;
  riskId: string;
  title: string;
  description?: string;
  owner: string;
  dueDate: string;
  status: 'planned' | 'active' | 'completed' | 'on_hold';
  effectiveness: number;
  notes?: string;
}

export interface Document {
  id: string;
  [key: string]: any;
}

export interface GroupMemberConfig {
  id: string;
  validFrom: string;
  validUntil: string | null;
}

export interface AssignmentGroup {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  userConfigs: GroupMemberConfig[];
  entitlementConfigs: GroupMemberConfig[];
  userIds?: string[];
  entitlementIds?: string[];
}

export interface HelpContent {
  id: string;
  section: string;
  title: string;
  content: string;
  order: number;
}
