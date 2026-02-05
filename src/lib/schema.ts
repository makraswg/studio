
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
  catalogs: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      name: 'VARCHAR(255) NOT NULL',
      version: 'VARCHAR(50)',
      provider: 'VARCHAR(100)',
      importedAt: 'VARCHAR(50)',
    }
  },
  hazardModules: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      catalogId: 'VARCHAR(255) NOT NULL',
      code: 'VARCHAR(50) NOT NULL',
      title: 'VARCHAR(255) NOT NULL',
    }
  },
  hazards: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      moduleId: 'VARCHAR(255) NOT NULL',
      code: 'VARCHAR(50) NOT NULL',
      title: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
      contentHash: 'VARCHAR(64)',
    }
  },
  hazardMeasures: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      code: 'VARCHAR(50) NOT NULL',
      title: 'VARCHAR(255) NOT NULL',
      baustein: 'VARCHAR(100)',
    }
  },
  hazardMeasureRelations: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      measureId: 'VARCHAR(255) NOT NULL',
      hazardCode: 'VARCHAR(50) NOT NULL',
    }
  },
  importRuns: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      catalogId: 'VARCHAR(255)',
      timestamp: 'VARCHAR(50)',
      status: 'VARCHAR(20)',
      itemCount: 'INT',
      log: 'LONGTEXT',
    }
  },
  risks: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      assetId: 'VARCHAR(255)',
      hazardId: 'VARCHAR(255)',
      parentId: 'VARCHAR(255)',
      title: 'VARCHAR(255) NOT NULL',
      category: 'VARCHAR(100)',
      description: 'TEXT',
      impact: 'INT DEFAULT 3',
      probability: 'INT DEFAULT 3',
      residualImpact: 'INT',
      residualProbability: 'INT',
      isImpactOverridden: 'BOOLEAN DEFAULT FALSE',
      isProbabilityOverridden: 'BOOLEAN DEFAULT FALSE',
      isResidualImpactOverridden: 'BOOLEAN DEFAULT FALSE',
      isResidualProbabilityOverridden: 'BOOLEAN DEFAULT FALSE',
      bruttoReason: 'TEXT',
      nettoReason: 'TEXT',
      owner: 'VARCHAR(255)',
      status: 'VARCHAR(50) DEFAULT "active"',
      acceptanceStatus: 'VARCHAR(20) DEFAULT "pending"',
      acceptanceReason: 'TEXT',
      acceptedBy: 'VARCHAR(255)',
      lastReviewDate: 'VARCHAR(50)',
      reviewCycleDays: 'INT',
      createdAt: 'VARCHAR(50) NOT NULL',
    },
  },
  riskMeasures: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      riskIds: 'TEXT', // Multi-Risk Support
      title: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
      owner: 'VARCHAR(255)',
      dueDate: 'VARCHAR(50)',
      status: 'VARCHAR(50) DEFAULT "planned"',
      effectiveness: 'INT DEFAULT 3',
      notes: 'TEXT',
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
      enabled: 'BOOLEAN DEFAULT FALSE',
      url: 'TEXT',
      email: 'VARCHAR(255)',
      apiToken: 'TEXT',
      projectKey: 'VARCHAR(50)',
      issueTypeName: 'VARCHAR(100)',
      approvedStatusName: 'VARCHAR(100)',
      doneStatusName: 'VARCHAR(100)',
      workspaceId: 'VARCHAR(255)',
      schemaId: 'VARCHAR(255)',
      autoSyncAssets: 'BOOLEAN DEFAULT FALSE',
    }
  },
  aiConfigs: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      enabled: 'BOOLEAN DEFAULT FALSE',
      provider: 'VARCHAR(50)',
      ollamaUrl: 'TEXT',
      ollamaModel: 'VARCHAR(100)',
      geminiModel: 'VARCHAR(100)',
    }
  },
  smtpConfigs: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      enabled: 'BOOLEAN DEFAULT FALSE',
      host: 'VARCHAR(255)',
      port: 'VARCHAR(10)',
      fromEmail: 'VARCHAR(255)',
    }
  },
  syncJobs: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      name: 'VARCHAR(255)',
      lastRun: 'VARCHAR(50)',
      lastStatus: 'VARCHAR(20)',
      lastMessage: 'TEXT',
    }
  },
  bundles: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
      entitlementIds: 'TEXT'
    }
  },
  groups: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
      userConfigs: 'TEXT',
      entitlementConfigs: 'TEXT',
      userIds: 'TEXT',
      entitlementIds: 'TEXT'
    }
  },
  entitlements: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      resourceId: 'VARCHAR(255) NOT NULL',
      parentId: 'VARCHAR(255)',
      name: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
      riskLevel: 'VARCHAR(50)',
      isAdmin: 'BOOLEAN DEFAULT FALSE',
      isSharedAccount: 'BOOLEAN DEFAULT FALSE',
      tenantId: 'VARCHAR(255)',
      externalMapping: 'VARCHAR(255)'
    }
  },
  resources: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      category: 'VARCHAR(100)',
      type: 'VARCHAR(100)',
      operatorId: 'VARCHAR(255)',
      dataClassification: 'VARCHAR(100)',
      dataLocation: 'VARCHAR(255)',
      mfaType: 'VARCHAR(100)',
      authMethod: 'VARCHAR(255)',
      url: 'TEXT',
      documentationUrl: 'TEXT',
      criticality: 'VARCHAR(50)',
      notes: 'TEXT',
      createdAt: 'VARCHAR(50)'
    }
  },
  assignments: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      userId: 'VARCHAR(255) NOT NULL',
      entitlementId: 'VARCHAR(255) NOT NULL',
      originGroupId: 'VARCHAR(255)',
      status: 'VARCHAR(50) NOT NULL',
      grantedBy: 'VARCHAR(255)',
      grantedAt: 'VARCHAR(50)',
      validFrom: 'VARCHAR(50)',
      validUntil: 'VARCHAR(50)',
      ticketRef: 'VARCHAR(255)',
      jiraIssueKey: 'VARCHAR(255)',
      notes: 'TEXT',
      lastReviewedAt: 'VARCHAR(50)',
      reviewedBy: 'VARCHAR(255)',
      tenantId: 'VARCHAR(255)',
      syncSource: 'VARCHAR(50)'
    }
  },
  helpContent: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      section: 'VARCHAR(255)',
      title: 'VARCHAR(255)',
      content: 'LONGTEXT',
      order: 'INT DEFAULT 0'
    }
  }
};
