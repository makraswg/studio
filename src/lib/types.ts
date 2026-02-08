
export type Role = 'tenantOwner' | 'admin' | 'editor' | 'viewer' | 'superAdmin' | string;
export type DataSource = 'firestore' | 'mock' | 'mysql';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  status: 'active' | 'archived';
  region?: string; 
  companyDescription?: string; 
  logoUrl?: string;
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
  status: 'active' | 'archived';
  description?: string;
}

export interface JobTitle {
  id: string;
  tenantId: string;
  departmentId: string;
  name: string;
  description?: string; 
  status: 'active' | 'archived';
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
  status?: 'active' | 'archived';
  onboardingDate?: string;
  offboardingDate?: string;
  lastSyncedAt: string;
  adGroups?: string[];
}

export interface Task {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigneeId: string; // PlatformUser ID
  creatorId: string; // PlatformUser ID
  entityType?: 'feature' | 'process' | 'risk' | 'measure' | 'resource' | 'role' | 'assignment';
  entityId?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface PlatformRole {
  id: string;
  name: string;
  description: string;
  permissions: {
    iam: 'none' | 'read' | 'write';
    risks: 'none' | 'read' | 'write';
    processhub: 'none' | 'read' | 'write';
    gdpr: 'none' | 'read' | 'write';
    settings: 'none' | 'read' | 'write';
    audit: 'none' | 'read' | 'write';
    media: 'none' | 'read' | 'write';
  };
}

export interface PlatformUser {
  id: string;
  uid?: string;
  email: string;
  password?: string;
  displayName: string;
  role: string; // ID of PlatformRole or legacy role
  tenantId: string;
  enabled: boolean | number;
  createdAt: string;
  authSource?: 'local' | 'ldap';
}

export interface MediaFile {
  id: string;
  tenantId: string;
  module: 'ProcessHub' | 'RiskHub' | 'General';
  entityId: string;
  subEntityId?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string; // Data URI or path
  ocrText?: string;
  createdAt: string;
  createdBy: string;
}

export interface MediaConfig {
  id: string;
  allowedTypes: string[]; // MIME types
  maxFileSize: number; // in bytes
}

export interface ProcessNode {
  id: string;
  type: 'step' | 'decision' | 'subprocess' | 'start' | 'end';
  title: string;
  description?: string;
  roleId?: string; 
  resourceIds?: string[];
  checklist?: string[];
  tips?: string;
  errors?: string;
  links?: { title: string; url: string }[];
  targetProcessId?: string; 
  customFields?: Record<string, string>;
}

export interface ProcessEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
}

export interface ProcessModel {
  nodes: ProcessNode[];
  edges: ProcessEdge[];
  roles: { id: string; name: string }[];
  isoFields?: Record<string, string>;
  customFields?: Record<string, string>;
}

export interface ProcessLayout {
  positions: Record<string, { x: number; y: number }>;
  swimlanes?: string[];
  collapsed?: string[];
}

export interface ProcessOperation {
  type: 'ADD_NODE' | 'UPDATE_NODE' | 'REMOVE_NODE' | 'ADD_EDGE' | 'UPDATE_EDGE' | 'REMOVE_EDGE' | 'REORDER_NODES' | 'UPDATE_LAYOUT' | 'SET_ISO_FIELD' | 'SET_CUSTOM_FIELD' | 'UPDATE_PROCESS_META';
  payload: any;
}

export interface Process {
  id: string;
  tenantId: string;
  responsibleDepartmentId?: string;
  title: string;
  description?: string;
  openQuestions?: string; 
  regulatoryFramework?: string; // Stored as JSON string or array
  status: 'draft' | 'published' | 'archived';
  ownerUserId: string;
  currentVersion: number;
  publishedVersion?: number;
  tags?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessVersion {
  id: string;
  process_id: string;
  version: number;
  model_json: ProcessModel;
  layout_json: ProcessLayout;
  revision: number;
  created_by_user_id: string;
  created_at: string;
}

export interface ProcessComment {
  id: string;
  process_id: string;
  node_id?: string;
  user_id: string;
  user_name: string;
  text: string;
  created_at: string;
}

export interface RegulatoryOption {
  id: string;
  tenantId?: string;
  name: string;
  description?: string;
  enabled: boolean | number;
}

export interface UsageTypeOption {
  id: string;
  name: string;
  description?: string;
  enabled: boolean | number;
}

export interface DataStore {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: 'active' | 'archived';
  ownerRoleId?: string;
}

export interface Feature {
  id: string;
  tenantId: string;
  name: string; 
  status: 'active' | 'in_preparation' | 'open_questions' | 'archived';
  carrier: 'wirtschaftseinheit' | 'objekt' | 'verwaltungseinheit' | 'mietvertrag' | 'geschaeftspartner';
  description: string;
  purpose: string;
  criticality: 'low' | 'medium' | 'high';
  criticalityScore: number;
  // Matrix Criteria
  matrixFinancial: boolean | number;
  matrixLegal: boolean | number;
  matrixExternal: boolean | number;
  matrixHardToCorrect: boolean | number;
  matrixAutomatedDecision: boolean | number;
  matrixPlanning: boolean | number;
  
  isComplianceRelevant: boolean | number;
  deptId: string; 
  ownerId?: string; 
  dataStoreId?: string; // Links to a Resource ID where isDataRepository is true
  maintenanceNotes?: string;
  validFrom?: string;
  validUntil?: string;
  changeReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureProcessStep {
  id: string;
  featureId: string;
  processId: string;
  nodeId: string;
  usageType: string;
  criticality: 'low' | 'medium' | 'high';
}

export interface FeatureProcessLink {
  id: string;
  featureId: string;
  processId: string;
  usageType: string;
  criticality: 'low' | 'medium' | 'high';
}

export interface FeatureLink {
  id: string;
  featureId: string;
  targetId: string;
  targetType: 'process_origin' | 'process_usage' | 'resource_origin' | 'resource_usage' | 'risk';
}

export interface FeatureDependency {
  id: string;
  featureId: string;
  dependentFeatureId: string;
  type: 'functional' | 'technical' | 'calculation' | 'rule';
  description: string;
  impact: string;
}

export interface Document {
  id: string;
  [key: string]: any;
}

export interface Resource {
  id: string;
  tenantId: string;
  name: string;
  status?: 'active' | 'archived';
  assetType: 'Hardware' | 'Software' | 'SaaS' | 'Infrastruktur';
  category: 'Fachanwendung' | 'Infrastruktur' | 'Sicherheitskomponente' | 'Support-Tool';
  operatingModel: 'On-Prem' | 'Cloud' | 'Hybrid' | 'Private Cloud';
  criticality: 'low' | 'medium' | 'high';
  dataClassification: 'public' | 'internal' | 'confidential' | 'strictly_confidential';
  confidentialityReq: 'low' | 'medium' | 'high';
  integrityReq: 'low' | 'medium' | 'high';
  availabilityReq: 'low' | 'medium' | 'high';
  hasPersonalData: boolean | number;
  hasSpecialCategoryData: boolean | number;
  isDataRepository: boolean | number;
  affectedGroups: string[];
  processingPurpose: string;
  dataLocation: string;
  isInternetExposed: boolean | number;
  isBusinessCritical: boolean | number;
  isSpof: boolean | number;
  systemOwner: string;
  operatorId: string;
  riskOwner: string;
  dataOwner: string;
  mfaType: 'none' | 'standard_otp' | 'standard_mail' | 'optional_otp' | 'optional_mail';
  authMethod: 'direct' | string;
  riskIds?: string[];
  measureIds?: string[];
  vvtIds?: string[];
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

export interface Risk {
  id: string;
  tenantId: string;
  assetId?: string;
  processId?: string;
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
  acceptanceStatus?: 'draft' | 'pending' | 'approved' | 'rejected';
  acceptanceComment?: string;
  lastReviewDate?: string;
  createdAt: string;
}

export interface RiskMeasure {
  id: string;
  riskIds: string[];
  resourceIds?: string[];
  title: string;
  description?: string;
  owner: string;
  dueDate: string;
  status: 'planned' | 'active' | 'completed' | 'on_hold';
  effectiveness: number;
  notes?: string;
  isTom?: boolean | number;
  tomCategory?: 'Zugriffskontrolle' | 'Zutrittskontrolle' | 'Weitergabekontrolle' | 'Verschlüsselung';
  art32Mapping?: string[];
  gdprProtectionGoals?: string[];
  isEffective?: boolean | number;
  checkType?: 'Audit' | 'Test' | 'Review';
  lastCheckDate?: string;
  evidenceDetails?: string;
}

export interface AssignmentGroup {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status?: 'active' | 'archived';
  userConfigs: { id: string; validFrom: string; validUntil: string | null }[];
  entitlementConfigs: { id: string; validFrom: string; validUntil: string | null }[];
}

export interface Bundle {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status?: 'active' | 'archived';
  entitlementIds: string[];
}

export interface HelpContent {
  id: string;
  section: string;
  title: string;
  content: string;
  order: number;
}

export interface SyncJob {
  id: string;
  name: string;
  lastRun?: string;
  lastStatus?: 'running' | 'success' | 'error';
  lastMessage?: string;
}

export interface JiraConfig {
  id: string;
  enabled: boolean | number;
  url: string;
  email: string;
  apiToken: string;
  projectKey: string;
  issueTypeName: string;
  approvedStatusName: string;
  doneStatusName: string;
  workspaceId?: string;
  schemaId?: string;
  objectTypeId?: string;
  entitlementObjectTypeId?: string;
  autoSyncAssets?: boolean | number;
}

export interface AiConfig {
  id: string;
  enabled: boolean | number;
  provider: 'ollama' | 'google' | 'openrouter';
  ollamaUrl?: string;
  ollamaModel?: string;
  geminiModel?: string;
  openrouterApiKey?: string;
  openrouterModel?: string;
  systemPrompt?: string;
}

export interface SmtpConfig {
  id: string;
  enabled: boolean | number;
  host: string;
  port: string;
  user: string;
  fromEmail: string;
}

export interface ImportRun {
  id: string;
  catalogId: string;
  timestamp: string;
  status: 'success' | 'partial' | 'failed';
  itemCount: number;
  log: string;
}

export interface Hazard {
  id: string;
  moduleId: string;
  code: string;
  title: string;
  description: string;
  contentHash: string;
}

export interface HazardModule {
  id: string;
  catalogId: string;
  code: string;
  title: string;
}

export interface Catalog {
  id: string;
  name: string;
  version: string;
  provider: string;
  importedAt: string;
}

export interface DataSubjectGroup {
  id: string;
  tenantId: string;
  name: string;
  status: 'active' | 'archived';
}

export interface DataCategory {
  id: string;
  tenantId: string;
  name: string;
  status: 'active' | 'archived';
  isGdprRelevant?: boolean | number;
}

export interface UiConfig {
  id: string;
  enableAdvancedAnimations: boolean | number;
  enableQuickTours: boolean | number;
  enableGlassmorphism: boolean | number;
  enableConfetti: boolean | number;
}

export interface BookStackConfig {
  id: string;
  enabled: boolean | number;
  url: string;
  token_id: string;
  token_secret: string;
  default_book_id: string;
}
