
'use server';

import { dbQuery, testMysqlConnection } from '@/lib/mysql';
import { initializeFirebase } from '@/firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { getMockCollection } from '@/lib/mock-db';
import { DataSource } from '@/lib/types';
import { appSchema } from '@/lib/schema';
import bcrypt from 'bcryptjs';

const collectionToTableMap: { [key: string]: string } = {
  users: 'users',
  platformUsers: 'platformUsers',
  platformRoles: 'platformRoles',
  tenants: 'tenants',
  auditEvents: 'auditEvents',
  catalogs: 'catalogs',
  hazardModules: 'hazardModules',
  hazards: 'hazards',
  hazardMeasures: 'hazardMeasures',
  hazardMeasureRelations: 'hazardMeasureRelations',
  importRuns: 'importRuns',
  risks: 'risks',
  riskMeasures: 'riskMeasures',
  riskControls: 'riskControls',
  resources: 'resources',
  entitlements: 'entitlements',
  assignments: 'assignments',
  groups: 'groups',
  bundles: 'bundles',
  jiraConfigs: 'jiraConfigs',
  aiConfigs: 'aiConfigs',
  smtpConfigs: 'smtpConfigs',
  syncJobs: 'syncJobs',
  helpContent: 'helpContent',
  processingActivities: 'processingActivities',
  dataSubjectGroups: 'dataSubjectGroups',
  dataCategories: 'dataCategories',
  departments: 'departments',
  jobTitles: 'jobTitles',
  servicePartners: 'service_partners',
  servicePartnerContacts: 'service_partner_contacts',
  servicePartnerAreas: 'service_partner_areas',
  dataStores: 'data_stores',
  assetTypeOptions: 'asset_type_options',
  operatingModelOptions: 'operating_model_options',
  processes: 'processes',
  process_types: 'process_types',
  process_versions: 'process_versions',
  process_comments: 'process_comments',
  process_ops: 'process_ops',
  ai_sessions: 'ai_sessions',
  ai_messages: 'ai_messages',
  uiConfigs: 'uiConfigs',
  features: 'features',
  feature_links: 'feature_links',
  feature_dependencies: 'feature_dependencies',
  feature_process_steps: 'feature_process_steps',
  bookstackConfigs: 'bookstack_configs',
  tasks: 'tasks',
  task_comments: 'task_comments',
  media: 'media',
  backup_jobs: 'backup_jobs',
  resource_update_processes: 'resource_update_processes',
  aiAuditCriteria: 'aiAuditCriteria'
};

function normalizeRecord(item: any, tableName: string) {
  if (!item) return null;
  const normalized = { ...item };
  
  const jsonFields: Record<string, string[]> = {
    users: ['adGroups'],
    groups: ['entitlementConfigs', 'userConfigs', 'entitlementIds', 'userIds'],
    bundles: ['entitlementIds'],
    auditEvents: ['before', 'after'],
    riskMeasures: ['riskIds', 'resourceIds'],
    resources: ['affectedGroups', 'riskIds', 'measureIds', 'vvtIds'],
    processingActivities: ['dataCategories', 'subjectCategories', 'resourceIds'],
    process_versions: ['model_json', 'layout_json'],
    process_ops: ['ops_json'],
    ai_sessions: ['context_json'],
    ai_messages: ['structured_json'],
    platformRoles: ['permissions'],
    processes: ['regulatoryFramework'],
    jobTitles: ['entitlementIds']
  };

  if (jsonFields[tableName]) {
    jsonFields[tableName].forEach(field => {
      if (item[field] && typeof item[field] === 'string') {
        try { normalized[field] = JSON.parse(item[field]); } catch (e) { normalized[field] = []; }
      }
    });
  }

  const boolFields = ['enabled', 'isAdmin', 'isSharedAccount', 'ldapEnabled', 'isTom', 'isEffective', 'isComplianceRelevant', 'isDataRepository', 'isGdprRelevant'];
  boolFields.forEach(f => {
    if (normalized[f] !== undefined) normalized[f] = normalized[f] === 1 || normalized[f] === true;
  });
  return normalized;
}

export async function getCollectionData(collectionName: string, dataSource: DataSource = 'mysql') {
  if (dataSource === 'mock') return { data: getMockCollection(collectionName), error: null };
  if (dataSource === 'firestore') {
    try {
      const { firestore } = initializeFirebase();
      const snap = await getDocs(collection(firestore, collectionName));
      return { data: snap.docs.map(d => ({ ...d.data(), id: d.id })), error: null };
    } catch (e: any) { return { data: null, error: e.message }; }
  }

  const tableName = collectionToTableMap[collectionName];
  if (!tableName) return { data: null, error: `Table mapping missing: ${collectionName}` };

  try {
    const rows: any = await dbQuery(`SELECT * FROM \`${tableName}\``);
    return { data: rows.map((item: any) => normalizeRecord(item, tableName)), error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
}

export async function getSingleRecord(collectionName: string, id: string, dataSource: DataSource = 'mysql') {
  if (dataSource === 'mock') {
    return { data: getMockCollection(collectionName).find(i => i.id === id) || null, error: null };
  }
  const tableName = collectionToTableMap[collectionName];
  if (!tableName) return { data: null, error: `Table mapping missing` };

  try {
    const rows: any = await dbQuery(`SELECT * FROM \`${tableName}\` WHERE id = ? LIMIT 1`, [id]);
    if (!rows || rows.length === 0) return { data: null, error: null };
    return { data: normalizeRecord(rows[0], tableName), error: null };
  } catch (error: any) {
    return { data: null, error: error.message };
  }
}

export async function saveCollectionRecord(collectionName: string, id: string, data: any, dataSource: DataSource = 'mysql') {
  if (dataSource === 'mock') return { success: true, error: null };
  if (dataSource === 'firestore') {
    try {
      const { firestore } = initializeFirebase();
      await setDoc(doc(firestore, collectionName, id), data, { merge: true });
      return { success: true, error: null };
    } catch (e: any) { return { success: false, error: e.message }; }
  }
  
  const tableName = collectionToTableMap[collectionName];
  const tableDef = appSchema[tableName];
  if (!tableName || !tableDef) return { success: false, error: `Schema for ${collectionName} not found` };
  
  const validColumns = Object.keys(tableDef.columns);
  try {
    const preparedData: any = { id };
    validColumns.forEach(col => {
      if (data[col] !== undefined) {
        let val = data[col];
        if (val !== null && typeof val === 'object') val = JSON.stringify(val);
        if (typeof val === 'boolean') val = val ? 1 : 0;
        preparedData[col] = val;
      }
    });

    const keys = Object.keys(preparedData);
    const values = Object.values(preparedData);
    const placeholders = keys.map(() => '?').join(', ');
    const updates = keys.map(key => `\`${key}\` = VALUES(\`${key}\`)`).join(', ');
    
    // Nutzt dbQuery, welche pool.execute() für Prepared Statements verwendet (Checkliste E)
    const sql = `INSERT INTO \`${tableName}\` (\`${keys.join('`, `')}\`) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`;
    await dbQuery(sql, values);
    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteCollectionRecord(collectionName: string, id: string, dataSource: DataSource = 'mysql') {
  const tableName = collectionToTableMap[collectionName];
  if (!tableName) return { success: false, error: `Table missing` };
  try {
    await dbQuery(`DELETE FROM \`${tableName}\` WHERE id = ?`, [id]);
    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function testMysqlConnectionAction() {
  return await testMysqlConnection();
}

export async function updatePlatformUserPasswordAction(email: string, password: string) {
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);
  try {
    await dbQuery('UPDATE `platformUsers` SET `password` = ? WHERE `email` = ?', [hashedPassword, email]);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function truncateDatabaseAreasAction() {
  try {
    const tables = ['users', 'tenants', 'risks', 'riskMeasures', 'riskControls', 'resources', 'entitlements', 'assignments', 'processes', 'process_versions', 'auditEvents', 'tasks', 'media'];
    await dbQuery('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of tables) {
      await dbQuery(`DELETE FROM \`${table}\``);
    }
    await dbQuery('SET FOREIGN_KEY_CHECKS = 1');
    return { success: true, message: "Daten bereinigt." };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
