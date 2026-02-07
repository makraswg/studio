
'use server';

import { getMysqlConnection, testMysqlConnection } from '@/lib/mysql';
import { initializeFirebase } from '@/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getMockCollection } from '@/lib/mock-db';
import { DataSource, User, PlatformUser } from '@/lib/types';
import bcrypt from 'bcryptjs';

/**
 * Mapping von Frontend-Kollektionsnamen zu echten MySQL-Tabellennamen.
 */
const collectionToTableMap: { [key: string]: string } = {
  users: 'users',
  platformUsers: 'platformUsers',
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
  processes: 'processes',
  process_versions: 'process_versions',
  process_comments: 'process_comments',
  process_ops: 'process_ops',
  ai_sessions: 'ai_sessions',
  ai_messages: 'ai_messages',
  uiConfigs: 'uiConfigs'
};

function normalizeRecord(item: any, tableName: string) {
  const normalized = { ...item };
  
  const jsonFields: Record<string, string[]> = {
    groups: ['entitlementConfigs', 'userConfigs', 'entitlementIds', 'userIds'],
    bundles: ['entitlementIds'],
    auditEvents: ['before', 'after'],
    riskMeasures: ['riskIds', 'resourceIds', 'art32Mapping', 'gdprProtectionGoals', 'vvtIds', 'dataCategories'],
    resources: ['affectedGroups', 'riskIds', 'measureIds', 'vvtIds'],
    processingActivities: ['dataCategories', 'subjectCategories', 'resourceIds'],
    process_versions: ['model_json', 'layout_json'],
    process_ops: ['ops_json'],
    ai_sessions: ['context_json'],
    ai_messages: ['structured_json']
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
    'isImpactOverridden', 'isProbabilityOverridden', 'isResidualImpactOverridden', 'isResidualProbabilityOverridden',
    'hasPersonalData', 'hasSpecialCategoryData', 'isInternetExposed', 'isBusinessCritical', 'isSpof',
    'isTom', 'isArt9Relevant', 'isEffective', 'enableAdvancedAnimations', 'enableQuickTours', 'enableGlassmorphism', 'enableConfetti'
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
  if (!tableName) return { data: null, error: `Invalid collection mapping: ${collectionName}` };
  let connection;
  try {
    connection = await getMysqlConnection();
    const [rows] = await connection.execute(`SELECT * FROM \`${tableName}\``);
    connection.release();
    let rawData = JSON.parse(JSON.stringify(rows));
    if (tableName === 'platformUsers') { rawData = rawData.map((u: any) => { const { password, ...rest } = u; return rest; }); }
    const data = rawData.map((item: any) => normalizeRecord(item, tableName));
    return { data, error: null };
  } catch (error: any) {
    if (connection) connection.release();
    return { data: null, error: error.message };
  }
}

export async function saveCollectionRecord(collectionName: string, id: string, data: any, dataSource: DataSource = 'mysql'): Promise<{ success: boolean; error: string | null }> {
  if (dataSource === 'firestore') {
    try {
      const { firestore } = initializeFirebase();
      await setDoc(doc(firestore, collectionName, id), data, { merge: true });
      return { success: true, error: null };
    } catch (e: any) { return { success: false, error: e.message }; }
  }
  const tableName = collectionToTableMap[collectionName];
  if (!tableName) return { success: false, error: `Invalid table mapping for collection: ${collectionName}` };
  let connection;
  try {
    connection = await getMysqlConnection();
    const preparedData = { ...data, id };
    
    // JSON Serialization
    const jsonFields: Record<string, string[]> = {
      groups: ['entitlementConfigs', 'userConfigs', 'entitlementIds', 'userIds'],
      bundles: ['entitlementIds'],
      auditEvents: ['before', 'after'],
      riskMeasures: ['riskIds', 'resourceIds', 'art32Mapping', 'gdprProtectionGoals', 'vvtIds', 'dataCategories'],
      resources: ['affectedGroups', 'riskIds', 'measureIds', 'vvtIds'],
      processingActivities: ['dataCategories', 'subjectCategories', 'resourceIds'],
      process_versions: ['model_json', 'layout_json'],
      process_ops: ['ops_json'],
      ai_sessions: ['context_json'],
      ai_messages: ['structured_json']
    };

    if (jsonFields[tableName]) {
      jsonFields[tableName].forEach(field => {
        if (preparedData[field] !== undefined && (Array.isArray(preparedData[field]) || typeof preparedData[field] === 'object')) {
          preparedData[field] = JSON.stringify(preparedData[field]);
        }
      });
    }

    const boolKeys = [
      'enabled', 'isAdmin', 'isSharedAccount', 'ldapEnabled', 'autoSyncAssets',
      'isImpactOverridden', 'isProbabilityOverridden', 'isResidualImpactOverridden', 'isResidualProbabilityOverridden',
      'hasPersonalData', 'hasSpecialCategoryData', 'isInternetExposed', 'isBusinessCritical', 'isSpof',
      'isTom', 'isArt9Relevant', 'isEffective', 'enableAdvancedAnimations', 'enableQuickTours', 'enableGlassmorphism', 'enableConfetti'
    ];
    boolKeys.forEach(key => { if (preparedData[key] !== undefined) preparedData[key] = preparedData[key] ? 1 : 0; });
    
    const keys = Object.keys(preparedData);
    const values = Object.values(preparedData);
    const placeholders = keys.map(() => '?').join(', ');
    const updates = keys.map(key => `\`${key}\` = VALUES(\`${key}\`)`).join(', ');
    const sql = `INSERT INTO \`${tableName}\` (\`${keys.join('`, `')}\`) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`;
    
    await connection.execute(sql, values);
    connection.release();
    return { success: true, error: null };
  } catch (error: any) {
    if (connection) connection.release();
    console.error(`Error saving to ${tableName}:`, error);
    return { success: false, error: error.message };
  }
}

export async function deleteCollectionRecord(collectionName: string, id: string, dataSource: DataSource = 'mysql'): Promise<{ success: boolean; error: string | null }> {
  if (dataSource === 'firestore') {
    try {
      const { firestore } = initializeFirebase();
      await deleteDoc(doc(firestore, collectionName, id));
      return { success: true, error: null };
    } catch (e: any) { return { success: false, error: e.message }; }
  }
  const tableName = collectionToTableMap[collectionName];
  if (!tableName) return { success: false, error: 'Invalid table' };
  let connection;
  try {
    connection = await getMysqlConnection();
    await connection.execute(`DELETE FROM \`${tableName}\` WHERE id = ?`, [id]);
    connection.release();
    return { success: true, error: null };
  } catch (error: any) {
    if (connection) connection.release();
    return { success: false, error: error.message };
  }
}

export async function truncateDatabaseAreasAction(): Promise<{ success: boolean; message: string }> {
  let connection;
  try {
    connection = await getMysqlConnection();
    
    const tablesToClear = [
      'users',
      'auditEvents',
      'catalogs',
      'hazardModules',
      'hazards',
      'hazardMeasures',
      'hazardMeasureRelations',
      'importRuns',
      'risks',
      'riskMeasures',
      'resources',
      'entitlements',
      'assignments',
      'groups',
      'bundles',
      'processingActivities',
      'dataSubjectGroups',
      'dataCategories',
      'departments',
      'jobTitles',
      'processes',
      'process_versions',
      'process_comments',
      'process_ops',
      'ai_sessions',
      'ai_messages',
      'uiConfigs'
    ];

    for (const table of tablesToClear) {
      await connection.execute(`DELETE FROM \`${table}\``);
    }

    connection.release();
    return { success: true, message: "Ausgewählte Datenbereiche wurden erfolgreich geleert." };
  } catch (error: any) {
    if (connection) connection.release();
    console.error("Truncate failed:", error);
    return { success: false, message: `Fehler beim Leeren der Tabellen: ${error.message}` };
  }
}

export async function testMysqlConnectionAction(): Promise<{ success: boolean; message: string; }> {
    return await testMysqlConnection();
}

export async function updatePlatformUserPasswordAction(email: string, newPassword: string): Promise<{ success: boolean; error: string | null }> {
  let connection;
  try {
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(newPassword, salt);
    connection = await getMysqlConnection();
    await connection.execute('UPDATE `platformUsers` SET `password` = ? WHERE `email` = ?', [hashedPassword, email]);
    connection.release();
    return { success: true, error: null };
  } catch (error: any) {
    if (connection) connection.release();
    return { success: false, error: error.message };
  }
}

/**
 * Befördert einen EAM-Benutzer zum Plattform-Administrator mit LDAP-Auth.
 */
export async function promoteUserToAdminAction(userId: string, dataSource: DataSource = 'mysql'): Promise<{ success: boolean; error?: string }> {
  try {
    const userRes = await getCollectionData('users', dataSource);
    const user = userRes.data?.find((u: User) => u.id === userId);
    
    if (!user) return { success: false, error: 'Benutzer nicht gefunden.' };

    const pUserId = `puser-ldap-${user.id}`;
    const pUserData: PlatformUser = {
      id: pUserId,
      email: user.email,
      displayName: user.displayName,
      role: 'admin',
      tenantId: user.tenantId,
      enabled: true,
      createdAt: new Date().toISOString(),
      authSource: 'ldap'
    };

    const res = await saveCollectionRecord('platformUsers', pUserId, pUserData, dataSource);
    return res;
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
