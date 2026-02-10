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
      status: 'VARCHAR(20) DEFAULT "active"',
      region: 'VARCHAR(100) DEFAULT "EU-DSGVO"',
      companyDescription: 'TEXT',
      logoUrl: 'TEXT',
      ldapEnabled: 'BOOLEAN DEFAULT FALSE',
      ldapUrl: 'TEXT',
      ldapPort: 'VARCHAR(10)',
      ldapBaseDn: 'TEXT',
      ldapBindDn: 'TEXT',
      ldapBindPassword: 'TEXT',
      ldapUserFilter: 'TEXT',
    },
  },
  departments: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
      status: 'VARCHAR(20) DEFAULT "active"',
    }
  },
  jobTitles: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      departmentId: 'VARCHAR(255) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      description: 'TEXT', 
      status: 'VARCHAR(20) DEFAULT "active"',
      entitlementIds: 'TEXT', 
    }
  },
  service_partners: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      industry: 'VARCHAR(255)',
      website: 'VARCHAR(255)',
      status: 'VARCHAR(20) DEFAULT "active"',
      createdAt: 'VARCHAR(50)',
    }
  },
  service_partner_contacts: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      partnerId: 'VARCHAR(255) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      email: 'VARCHAR(255) NOT NULL',
      phone: 'VARCHAR(50)',
      role: 'VARCHAR(255)',
    }
  },
  service_partner_areas: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      partnerId: 'VARCHAR(255) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
    }
  },
  asset_type_options: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      name: 'VARCHAR(255) NOT NULL',
      enabled: 'BOOLEAN DEFAULT TRUE',
    }
  },
  operating_model_options: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      name: 'VARCHAR(255) NOT NULL',
      enabled: 'BOOLEAN DEFAULT TRUE',
    }
  },
  process_types: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      name: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
      enabled: 'BOOLEAN DEFAULT TRUE',
    }
  },
  data_stores: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
      status: 'VARCHAR(20) DEFAULT "active"',
      ownerRoleId: 'VARCHAR(255)',
    }
  },
  platformRoles: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      name: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
      permissions: 'LONGTEXT', 
    }
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
      authSource: 'VARCHAR(20) DEFAULT "local"',
      totpEnabled: 'BOOLEAN DEFAULT FALSE',
      totpSecret: 'VARCHAR(255)',
    },
  },
  magic_links: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      email: 'VARCHAR(255) NOT NULL',
      token: 'VARCHAR(255) NOT NULL',
      expiresAt: 'VARCHAR(50) NOT NULL',
      used: 'BOOLEAN DEFAULT FALSE'
    }
  },
  tasks: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      title: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
      status: 'VARCHAR(50) DEFAULT "todo"',
      priority: 'VARCHAR(50) DEFAULT "medium"',
      assigneeId: 'VARCHAR(255)',
      creatorId: 'VARCHAR(255)',
      entityType: 'VARCHAR(50)', 
      entityId: 'VARCHAR(255)',
      dueDate: 'VARCHAR(50)',
      createdAt: 'VARCHAR(50) NOT NULL',
      updatedAt: 'VARCHAR(50) NOT NULL',
    }
  },
  task_comments: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      taskId: 'VARCHAR(255) NOT NULL',
      userId: 'VARCHAR(255) NOT NULL',
      userName: 'VARCHAR(255)',
      text: 'TEXT NOT NULL',
      createdAt: 'VARCHAR(50) NOT NULL',
    }
  },
  media: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      module: 'VARCHAR(50) NOT NULL',
      entityId: 'VARCHAR(255) NOT NULL',
      subEntityId: 'VARCHAR(255)',
      fileName: 'VARCHAR(255) NOT NULL',
      fileType: 'VARCHAR(100) NOT NULL',
      fileSize: 'BIGINT NOT NULL',
      fileUrl: 'LONGTEXT NOT NULL',
      ocrText: 'LONGTEXT',
      createdAt: 'VARCHAR(50) NOT NULL',
      createdBy: 'VARCHAR(255) NOT NULL',
    }
  },
  media_configs: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      allowedTypes: 'TEXT', 
      maxFileSize: 'BIGINT DEFAULT 5242880', 
    }
  },
  features: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      status: 'VARCHAR(50) DEFAULT "active"',
      carrier: 'VARCHAR(50) NOT NULL',
      description: 'TEXT',
      purpose: 'TEXT',
      criticality: 'VARCHAR(20) DEFAULT "low"',
      criticalityScore: 'INT DEFAULT 0',
      confidentialityReq: 'VARCHAR(20) DEFAULT "low"',
      integrityReq: 'VARCHAR(20) DEFAULT "low"',
      availabilityReq: 'VARCHAR(20) DEFAULT "low"',
      matrixFinancial: 'BOOLEAN DEFAULT FALSE',
      matrixLegal: 'BOOLEAN DEFAULT FALSE',
      matrixExternal: 'BOOLEAN DEFAULT FALSE',
      matrixHardToCorrect: 'BOOLEAN DEFAULT FALSE',
      matrixAutomatedDecision: 'BOOLEAN DEFAULT FALSE',
      matrixPlanning: 'BOOLEAN DEFAULT FALSE',
      isComplianceRelevant: 'BOOLEAN DEFAULT FALSE',
      deptId: 'VARCHAR(255) NOT NULL',
      ownerId: 'VARCHAR(255)',
      dataStoreId: 'VARCHAR(255)',
      maintenanceNotes: 'TEXT',
      validFrom: 'VARCHAR(50)',
      validUntil: 'VARCHAR(50)',
      changeReason: 'TEXT',
      createdAt: 'VARCHAR(50) NOT NULL',
      updatedAt: 'VARCHAR(50) NOT NULL',
    }
  },
  feature_process_steps: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      featureId: 'VARCHAR(255) NOT NULL',
      processId: 'VARCHAR(255) NOT NULL',
      nodeId: 'VARCHAR(255) NOT NULL',
      usageType: 'VARCHAR(100)',
      criticality: 'VARCHAR(20) DEFAULT "low"',
    }
  },
  processes: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      responsibleDepartmentId: 'VARCHAR(255)',
      vvtId: 'VARCHAR(255)', 
      processTypeId: 'VARCHAR(255)',
      title: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
      inputs: 'TEXT',
      outputs: 'TEXT',
      kpis: 'TEXT',
      openQuestions: 'TEXT',
      regulatoryFramework: 'TEXT', 
      status: 'VARCHAR(50) DEFAULT "draft"',
      ownerUserId: 'VARCHAR(255)',
      currentVersion: 'INT DEFAULT 1',
      publishedVersion: 'INT',
      automationLevel: 'VARCHAR(50)',
      dataVolume: 'VARCHAR(50)',
      processingFrequency: 'VARCHAR(50)',
      createdAt: 'VARCHAR(50)',
      updatedAt: 'VARCHAR(50)',
      tags: 'TEXT',
    }
  },
  process_versions: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      process_id: 'VARCHAR(255) NOT NULL',
      version: 'INT NOT NULL',
      model_json: 'LONGTEXT', 
      layout_json: 'LONGTEXT', 
      revision: 'INT DEFAULT 0',
      created_by_user_id: 'VARCHAR(255)',
      created_at: 'VARCHAR(50)',
    }
  },
  regulatory_options: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255)',
      name: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
      enabled: 'BOOLEAN DEFAULT TRUE',
    }
  },
  usage_type_options: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      name: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
      enabled: 'BOOLEAN DEFAULT TRUE',
    }
  },
  risks: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      assetId: 'VARCHAR(255)',
      processId: 'VARCHAR(255)',
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
      treatmentStrategy: 'VARCHAR(50) DEFAULT "mitigate"',
      owner: 'VARCHAR(255)',
      status: 'VARCHAR(50) DEFAULT "active"',
      acceptanceStatus: 'VARCHAR(50) DEFAULT "draft"',
      acceptanceComment: 'TEXT',
      lastReviewDate: 'VARCHAR(50)',
      createdAt: 'VARCHAR(50) NOT NULL',
    },
  },
  riskMeasures: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      riskIds: 'TEXT',
      resourceIds: 'TEXT',
      title: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
      owner: 'VARCHAR(255)',
      dueDate: 'VARCHAR(50)',
      status: 'VARCHAR(50) DEFAULT "planned"',
      effectiveness: 'INT DEFAULT 3',
      notes: 'TEXT',
      isTom: 'BOOLEAN DEFAULT FALSE',
      tomCategory: 'VARCHAR(100)',
    },
  },
  riskControls: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      measureId: 'VARCHAR(255) NOT NULL',
      title: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
      owner: 'VARCHAR(255)',
      status: 'VARCHAR(50) DEFAULT "scheduled"',
      isEffective: 'BOOLEAN DEFAULT FALSE',
      checkType: 'VARCHAR(50)',
      lastCheckDate: 'VARCHAR(50)',
      nextCheckDate: 'VARCHAR(50)',
      evidenceDetails: 'TEXT'
    }
  },
  processingActivities: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      originalId: 'VARCHAR(255)',
      tenantId: 'VARCHAR(255) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      version: 'VARCHAR(50) DEFAULT "1.0"',
      description: 'TEXT',
      responsibleDepartment: 'VARCHAR(255)',
      legalBasis: 'VARCHAR(255)',
      dataCategories: 'TEXT',
      subjectCategories: 'TEXT',
      recipientCategories: 'TEXT',
      retentionPeriod: 'VARCHAR(255)',
      status: 'VARCHAR(50) DEFAULT "active"',
      lastReviewDate: 'VARCHAR(50)',
      resourceIds: 'TEXT',
      jointController: 'BOOLEAN DEFAULT FALSE',
      jointControllerDetails: 'TEXT',
      dataProcessorId: 'VARCHAR(255)',
      receiverCategoriesDetails: 'TEXT',
      thirdCountryTransfer: 'BOOLEAN DEFAULT FALSE',
      targetCountry: 'VARCHAR(255)',
      transferMechanism: 'VARCHAR(50)'
    }
  },
  resources: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      status: 'VARCHAR(20) DEFAULT "active"',
      assetType: 'VARCHAR(100)',
      category: 'VARCHAR(100)',
      operatingModel: 'VARCHAR(100)',
      criticality: 'VARCHAR(50)',
      dataClassification: 'VARCHAR(100)',
      confidentialityReq: 'VARCHAR(50)',
      integrityReq: 'VARCHAR(50)',
      availabilityReq: 'VARCHAR(50)',
      hasPersonalData: 'BOOLEAN DEFAULT FALSE',
      hasSpecialCategoryData: 'BOOLEAN DEFAULT FALSE',
      isDataRepository: 'BOOLEAN DEFAULT FALSE',
      isIdentityProvider: 'BOOLEAN DEFAULT FALSE',
      identityProviderId: 'VARCHAR(255)',
      affectedGroups: 'TEXT',
      dataLocation: 'VARCHAR(255)',
      isInternetExposed: 'BOOLEAN DEFAULT FALSE',
      isBusinessCritical: 'BOOLEAN DEFAULT FALSE',
      isSpof: 'BOOLEAN DEFAULT FALSE',
      systemOwnerRoleId: 'VARCHAR(255)',
      riskOwnerRoleId: 'VARCHAR(255)',
      externalOwnerPartnerId: 'VARCHAR(255)',
      externalOwnerContactId: 'VARCHAR(255)',
      externalOwnerAreaId: 'VARCHAR(255)',
      operatorId: 'VARCHAR(255)',
      riskOwner: 'VARCHAR(255)',
      dataOwner: 'VARCHAR(255)',
      mfaType: 'VARCHAR(100)',
      authMethod: 'VARCHAR(255)',
      riskIds: 'TEXT',
      measureIds: 'TEXT',
      vvtIds: 'TEXT',
      url: 'TEXT',
      documentationUrl: 'TEXT',
      notes: 'TEXT',
      createdAt: 'VARCHAR(50)',
      backupRequired: 'BOOLEAN DEFAULT FALSE',
      updatesRequired: 'BOOLEAN DEFAULT FALSE'
    }
  },
  backup_jobs: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      resourceId: 'VARCHAR(255) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      cycle: 'VARCHAR(50) DEFAULT "daily"',
      location: 'VARCHAR(255)',
      description: 'TEXT',
      lastReviewDate: 'VARCHAR(50)'
    }
  },
  update_processes: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      resourceId: 'VARCHAR(255) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      frequency: 'VARCHAR(50) DEFAULT "monthly"',
      description: 'TEXT',
      responsibleRoleId: 'VARCHAR(255)',
      lastRunDate: 'VARCHAR(50)'
    }
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
      objectTypeId: 'VARCHAR(255)',
      entitlementObjectTypeId: 'VARCHAR(255)',
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
      openrouterApiKey: 'TEXT',
      openrouterModel: 'VARCHAR(100)',
      systemPrompt: 'TEXT',
    }
  },
  aiAuditCriteria: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      title: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
      severity: 'VARCHAR(50) DEFAULT "medium"',
      enabled: 'BOOLEAN DEFAULT TRUE',
      category: 'VARCHAR(100)'
    }
  },
  smtpConfigs: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      enabled: 'BOOLEAN DEFAULT FALSE',
      host: 'VARCHAR(255)',
      port: 'VARCHAR(10)',
      fromEmail: 'VARCHAR(255)',
      user: 'VARCHAR(255)',
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
      status: 'VARCHAR(20) DEFAULT "active"',
      entitlementIds: 'TEXT'
    }
  },
  groups: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      tenantId: 'VARCHAR(255) NOT NULL',
      name: 'VARCHAR(255) NOT NULL',
      description: 'TEXT',
      status: 'VARCHAR(20) DEFAULT "active"',
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
  uiConfigs: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      enableAdvancedAnimations: 'BOOLEAN DEFAULT TRUE',
      enableQuickTours: 'BOOLEAN DEFAULT TRUE',
      enableGlassmorphism: 'BOOLEAN DEFAULT TRUE',
      enableConfetti: 'BOOLEAN DEFAULT TRUE',
    }
  },
  bookstack_configs: {
    columns: {
      id: 'VARCHAR(255) PRIMARY KEY',
      enabled: 'BOOLEAN DEFAULT FALSE',
      url: 'TEXT',
      token_id: 'TEXT',
      token_secret: 'TEXT',
      default_book_id: 'VARCHAR(50)',
    }
  }
};
