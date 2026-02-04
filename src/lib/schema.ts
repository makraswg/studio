
export interface TableDefinition {
  columns: {
    [columnName: string]: string;
  };
}

export interface AppSchema {
  [tableName: string]: TableDefinition;
}

export const appSchema: AppSchema = {
  tenants: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      name: 'VARCHAR(255) NOT NULL',
      slug: 'VARCHAR(100) UNIQUE NOT NULL',
      createdAt: 'VARCHAR(50) NOT NULL',
      ldapEnabled: 'BOOLEAN DEFAULT FALSE',
      ldapUrl: 'TEXT',
      ldapPort: 'VARCHAR(10)',
      ldapBaseDn: 'TEXT',
      ldapBindDn: 'TEXT',
      ldapBindPassword: 'TEXT',
      ldapUserFilter: 'TEXT',
    },
  },
  platformUsers: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      uid: 'VARCHAR(255)',
      email: 'VARCHAR(255) NOT NULL',
      password: 'VARCHAR(255)',
      displayName: 'VARCHAR(255) NOT NULL',
      role: 'VARCHAR(50) NOT NULL',
      tenantId: 'VARCHAR(255) DEFAULT "all"',
      enabled: 'BOOLEAN DEFAULT TRUE',
      createdAt: 'VARCHAR(50)',
    },
  },
  servicePartners: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      contactPerson: 'VARCHAR(255)',
      email: 'VARCHAR(255)',
      phone: 'VARCHAR(50)',
    },
  },
  users: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      externalId: 'VARCHAR(255)',
      displayName: 'VARCHAR(255) NOT NULL',
      email: 'VARCHAR(255) NOT NULL',
      department: 'VARCHAR(255)',
      title: 'VARCHAR(255)',
      enabled: 'BOOLEAN DEFAULT TRUE',
      onboardingDate: 'VARCHAR(50)',
      offboardingDate: 'VARCHAR(50)',
      lastSyncedAt: 'VARCHAR(50)',
      adGroups: 'TEXT',
    },
  },
  groups: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
      entitlementIds: 'TEXT',
      userIds: 'TEXT',
      validFrom: 'VARCHAR(50)',
      validUntil: 'VARCHAR(50)',
    },
  },
  bundles: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
      entitlementIds: 'TEXT',
    }
  },
  resources: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      category: 'VARCHAR(50)',
      type: 'VARCHAR(100)',
      operatorId: 'VARCHAR(255)',
      dataClassification: 'VARCHAR(50)',
      dataLocation: 'VARCHAR(255)',
      mfaType: 'VARCHAR(50)',
      authMethod: 'VARCHAR(255)',
      url: 'TEXT',
      documentationUrl: 'TEXT',
      criticality: 'VARCHAR(20) DEFAULT "medium"',
      notes: 'TEXT',
      createdAt: 'VARCHAR(50)',
    },
  },
  entitlements: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      resourceId: 'VARCHAR(255) NOT NULL',
      parentId: 'VARCHAR(255)',
      name: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
      riskLevel: 'VARCHAR(20) DEFAULT "medium"',
      isAdmin: 'BOOLEAN DEFAULT FALSE',
      isSharedAccount: 'BOOLEAN DEFAULT FALSE',
      passwordManagerUrl: 'TEXT',
      externalMapping: 'TEXT',
    },
  },
  assignments: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      userId: 'VARCHAR(255) NOT NULL',
      entitlementId: 'VARCHAR(255) NOT NULL',
      originGroupId: 'VARCHAR(255)',
      status: 'VARCHAR(50) DEFAULT "active"',
      grantedBy: 'VARCHAR(255)',
      grantedAt: 'VARCHAR(50)',
      validFrom: 'VARCHAR(50)',
      validUntil: 'VARCHAR(50)',
      lastReviewedAt: 'VARCHAR(50)',
      ticketRef: 'VARCHAR(255)',
      jiraIssueKey: 'VARCHAR(50)',
      notes: 'TEXT',
      syncSource: 'VARCHAR(50) DEFAULT "manual"',
    },
  },
  auditEvents: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      actorUid: 'VARCHAR(255) NOT NULL',
      action: 'VARCHAR(255) NOT NULL',
      entityType: 'VARCHAR(50) NOT NULL',
      entityId: 'VARCHAR(255) NOT NULL',
      timestamp: 'VARCHAR(50) NOT NULL',
      before: 'TEXT',
      after: 'TEXT',
    },
  },
  jiraConfigs: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      url: 'TEXT NOT NULL',
      email: 'VARCHAR(255)',
      apiToken: 'TEXT',
      apiTokenExpiresAt: 'VARCHAR(50)',
      projectKey: 'VARCHAR(50)',
      issueTypeName: 'VARCHAR(100)',
      approvedStatusName: 'VARCHAR(100)',
      doneStatusName: 'VARCHAR(100)',
      enabled: 'BOOLEAN DEFAULT FALSE',
      assetsWorkspaceId: 'VARCHAR(255)',
      assetsSchemaId: 'VARCHAR(255)',
      assetsResourceObjectTypeId: 'VARCHAR(255)',
      assetsRoleObjectTypeId: 'VARCHAR(255)',
      assetsResourceNameAttributeId: 'VARCHAR(255)',
      assetsRoleNameAttributeId: 'VARCHAR(255)',
      assetsSystemAttributeId: 'VARCHAR(255)',
    }
  },
  smtpConfigs: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      host: 'VARCHAR(255) NOT NULL',
      port: 'VARCHAR(10) NOT NULL',
      user: 'VARCHAR(255)',
      pass: 'VARCHAR(255)',
      fromEmail: 'VARCHAR(255)',
      fromName: 'VARCHAR(255)',
      encryption: 'VARCHAR(20)',
      enabled: 'BOOLEAN DEFAULT FALSE',
    }
  },
  aiConfigs: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      provider: 'VARCHAR(50) NOT NULL',
      ollamaUrl: 'TEXT',
      ollamaModel: 'VARCHAR(255)',
      geminiModel: 'VARCHAR(255)',
      enabled: 'BOOLEAN DEFAULT TRUE',
    }
  }
};
