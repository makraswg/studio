
export type Role = 'tenantOwner' | 'admin' | 'editor' | 'viewer' | 'superAdmin';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface TenantMember {
  uid: string;
  role: Role;
  status: 'active' | 'invited';
  email: string;
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
  type: 'SaaS' | 'OnPrem' | 'Shop' | 'Tool' | 'Other';
  owner: string;
  url: string;
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
}

export interface Assignment {
  id: string;
  userId: string;
  entitlementId: string;
  status: 'active' | 'requested' | 'removed';
  grantedBy: string;
  grantedAt: string;
  ticketRef: string;
  validUntil?: string;
  notes: string;
  lastReviewedAt?: string;
  reviewedBy?: string;
}

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  actorUid: string;
  action: string;
  entityType: 'resource' | 'entitlement' | 'assignment' | 'member';
  entityId: string;
  before?: any;
  after?: any;
  timestamp: string;
}
