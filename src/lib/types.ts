
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

export interface Department {
  id: string;
  tenantId: string;
  name: string;
}

export interface JobTitle {
  id: string;
  tenantId: string;
  departmentId: string;
  name: string;
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

export interface DataSubjectGroup {
  id: string;
  tenantId: string;
  name: string;
}

export interface DataCategory {
  id: string;
  tenantId: string;
  name: string;
}

export interface Resource {
  id: string;
  tenantId: string;
  name: string;
  // Asset & System
  assetType: 'Hardware' | 'Software' | 'SaaS' | 'Infrastruktur';
  category: 'Fachanwendung' | 'Infrastruktur' | 'Sicherheitskomponente' | 'Support-Tool';
  operatingModel: 'On-Prem' | 'Cloud' | 'Hybrid' | 'Private Cloud';
  criticality: 'low' | 'medium' | 'high';
  
  // Compliance & Protection
  dataClassification: 'public' | 'internal' | 'confidential' | 'strictly_confidential';
  confidentialityReq: 'low' | 'medium' | 'high';
  integrityReq: 'low' | 'medium' | 'high';
  availabilityReq: 'low' | 'medium' | 'high';
  
  // DSGVO Trigger
  hasPersonalData: boolean | number;
  hasSpecialCategoryData: boolean | number;
  affectedGroups: string[]; // Mitarbeitende, Kunden, etc.
  processingPurpose: string;
  dataLocation: string;
  
  // Risk & Architecture
  isInternetExposed: boolean | number;
  isBusinessCritical: boolean | number;
  isSpof: boolean | number;
  
  // Responsibility
  systemOwner: string;
  operatorId: string; // Service Partner / Technical Operator
  riskOwner: string;
  dataOwner: string;
  
  // IAM
  mfaType: 'none' | 'standard_otp' | 'standard_mail' | 'optional_otp' | 'optional_mail';
  authMethod: 'direct' | string;
  
  // Links (JSON Arrays)
  riskIds?: string[];
  measureIds?: string[];
  vvtIds?: string[]; // IDs of ProcessingActivities
  
  url: string;
  documentationUrl?: string;
  notes: string;
  createdAt?: string;
}

export interface ProcessingActivity {
  id: string;
  originalId?: string;
  tenantId: string;
  name: string;
  version: string;
  description: string;
  responsibleDepartment: string;
  legalBasis: string;
  dataCategories: string[];
  subjectCategories: string[];
  recipientCategories: string;
  retentionPeriod: string;
  status: 'draft' | 'active' | 'archived';
  lastReviewDate: string;
  resourceIds?: string[];
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
  workspaceId?: string;
  schemaId?: string;
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

export interface Catalog {
  id: string;
  name: string;
  version: string;
  provider: string;
  importedAt: string;
}

export interface HazardModule {
  id: string;
  catalogId: string;
  code: string;
  title: string;
}

export interface Hazard {
  id: string;
  moduleId: string;
  code: string;
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

export interface Risk {
  id: string;
  tenantId: string;
  assetId?: string;
  hazardId?: string;
  parentId?: string;
  title: string;
  category: string;
  description: string;
  impact: number;
  probability: number;
  residualImpact?: number;
  residualProbability?: number;
  isImpactOverridden?: boolean | number;
  isProbabilityOverridden?: boolean | number;
  isResidualImpactOverridden?: boolean | number;
  isResidualProbabilityOverridden?: boolean | number;
  bruttoReason?: string;
  nettoReason?: string;
  owner: string;
  status: 'active' | 'mitigated' | 'accepted' | 'closed';
  acceptanceStatus?: 'pending' | 'accepted' | 'rejected';
  lastReviewDate?: string;
  createdAt: string;
}

export interface RiskMeasure {
  id: string;
  riskIds: string[]; // Associated Risks
  resourceIds?: string[]; // Associated Systems
  title: string;
  description?: string;
  owner: string;
  dueDate: string;
  status: 'planned' | 'active' | 'completed' | 'on_hold';
  effectiveness: number;
  notes?: string;
  
  // TOM Fields
  isTom?: boolean | number;
  tomCategory?: 'Zugriffskontrolle' | 'Zutrittskontrolle' | 'Weitergabekontrolle' | 'Eingabekontrolle' | 'Auftragskontrolle' | 'Verfügbarkeitskontrolle' | 'Trennungsgebot' | 'Verschlüsselung / Pseudonymisierung' | 'Wiederherstellbarkeit' | 'Wirksamkeitsprüfung';
  art32Mapping?: string[]; // lit. a, b, c, d
  gdprProtectionGoals?: string[]; // Vertraulichkeit, Integrität, Verfügbarkeit, Belastbarkeit
  vvtIds?: string[]; // Associated Processing Activities
  dataCategories?: string[]; // Associated Data Categories from Settings
  isArt9Relevant?: boolean | number;
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
