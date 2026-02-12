
'use server';

import { getMysqlConnection, testMysqlConnection } from '@/lib/mysql';
import { initializeFirebase } from '@/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
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
      if (item[field]) {
        try {
          normalized[field] = typeof item[field] === 'string' ? JSON.parse(item[field]) : item[field];
        } catch (e) {
          normalized[field] = Array.isArray(item[field]) ? [] : {};
        }
      }
    });
  }

  const boolFields = [
    'enabled', 'isAdmin', 'isSharedAccount', 'ldapEnabled', 'autoSyncAssets',
    'isTom', 'isEffective', 'isComplianceRelevant', 'isDataRepository', 'isGdprRelevant'
  ];
  boolFields.forEach(f => {
    if (normalized[f] !== undefined && normalized[f] !== null) {
      normalized[f] = normalized[f] === 1 || normalized[f] === true || normalized[f] === '1';
    }
  });
  return normalized;
}

export async function getCollectionData(collectionName: string, dataSource: DataSource = 'mysql'): Promise<{ data: any[] | null; error: string | null; }> {
  if (dataSource === 'mock') return { data: getMockCollection(collectionName), error: null };
  if (dataSource === 'firestore') {
    try {
      const { firestore } = initializeFirebase();
      const snap = await getDocs(collection(firestore, collectionName));
      const data = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      return { data, error: null };
    } catch (e: any) { return { data: null, error: e.message }; }
  }
  const tableName = collectionToTableMap[collectionName];
  if (!tableName) return { data: null, error: `Mapping fehlt: ${collectionName}` };
  let connection;
  try {
    connection = await getMysqlConnection();
    const [rows] = await connection.execute(`SELECT * FROM \`${tableName}\``);
    const data = (rows as any[]).map((item: any) => normalizeRecord(item, tableName));
    return { data, error: null };
  } catch (error: any) {
    console.error(`[MySQL-Fetch-Error] ${tableName}:`, error.message);
    return { data: null, error: error.message };
  } finally {
    if (connection) connection.release();
  }
}

export async function getSingleRecord(collectionName: string, id: string, dataSource: DataSource = 'mysql'): Promise<{ data: any | null; error: string | null; }> {
  if (dataSource === 'mock') {
    const coll = getMockCollection(collectionName);
    return { data: coll.find(i => i.id === id) || null, error: null };
  }
  const tableName = collectionToTableMap[collectionName];
  if (!tableName) return { data: null, error: `Mapping fehlt: ${collectionName}` };
  let connection;
  try {
    connection = await getMysqlConnection();
    const [rows]: any = await connection.execute(`SELECT * FROM \`${tableName}\` WHERE id = ? LIMIT 1`, [id]);
    if (!rows || rows.length === 0) return { data: null, error: null };
    return { data: normalizeRecord(rows[0], tableName), error: null };
  } catch (error: any) {
    console.error(`[MySQL-Single-Error] ${tableName}:`, error.message);
    return { data: null, error: error.message };
  } finally {
    if (connection) connection.release();
  }
}

export async function saveCollectionRecord(collectionName: string, id: string, data: any, dataSource: DataSource = 'mysql'): Promise<{ success: boolean; error: string | null }> {
  if (dataSource === 'mock') return { success: true, error: null };
  if (dataSource === 'firestore') {
    try {
      const { firestore } = initializeFirebase();
      await setDoc(doc(firestore, collectionName, id), data, { merge: true });
      return { success: true, error: null };
    } catch (e: any) { return { success: false, error: e.message }; }
  }
  
  const tableName = collectionToTableMap[collectionName];
  if (!tableName) return { success: false, error: `Tabelle nicht gefunden: ${collectionName}` };
  
  const tableDef = appSchema[tableName];
  if (!tableDef) return { success: false, error: `Schema-Definition fehlt für: ${tableName}` };
  
  const validColumns = Object.keys(tableDef.columns);

  let connection;
  try {
    connection = await getMysqlConnection();
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
    const sql = `INSERT INTO \`${tableName}\` (\`${keys.join('`, `')}\`) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`;
    
    await connection.execute(sql, values);
    return { success: true, error: null };
  } catch (error: any) {
    console.error(`[MySQL-Save-Error] ${tableName}:`, error.message);
    return { success: false, error: error.message };
  } finally {
    if (connection) connection.release();
  }
}

export async function deleteCollectionRecord(collectionName: string, id: string, dataSource: DataSource = 'mysql'): Promise<{ success: boolean; error: string | null }> {
  const tableName = collectionToTableMap[collectionName];
  if (!tableName) return { success: false, error: `Tabelle nicht gefunden` };
  let connection;
  try {
    connection = await getMysqlConnection();
    await connection.execute(`DELETE FROM \`${tableName}\` WHERE id = ?`, [id]);
    return { success: true, error: null };
  } catch (error: any) {
    console.error(`[MySQL-Delete-Error] ${tableName}:`, error.message);
    return { success: false, error: error.message };
  } finally {
    if (connection) connection.release();
  }
}

export async function truncateDatabaseAreasAction(): Promise<{ success: boolean; message: string }> {
  let connection;
  try {
    connection = await getMysqlConnection();
    const tables = ['users', 'tenants', 'risks', 'riskMeasures', 'riskControls', 'resources', 'entitlements', 'assignments', 'processes', 'process_versions', 'auditEvents'];
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of tables) {
      try { await connection.execute(`DELETE FROM \`${table}\``); } catch (e) {}
    }
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    return { success: true, message: "Daten bereinigt." };
  } catch (error: any) {
    console.error(`[MySQL-Truncate-Error]:`, error.message);
    return { success: false, message: error.message };
  } finally {
    if (connection) connection.release();
  }
}

export async function testMysqlConnectionAction(): Promise<{ success: boolean; message: string; }> {
    return await testMysqlConnection();
}

export async function updatePlatformUserPasswordAction(email: string, password: string): Promise<{ success: boolean }> {
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);
  let connection;
  try {
    connection = await getMysqlConnection();
    await connection.execute(
      'UPDATE `platformUsers` SET `password` = ? WHERE `email` = ?',
      [hashedPassword, email]
    );
    return { success: true };
  } catch (error: any) {
    console.error("Password update failed:", error);
    return { success: false };
  } finally {
    if (connection) connection.release();
  }
}
