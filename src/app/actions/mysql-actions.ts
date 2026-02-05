
'use server';

import { getMysqlConnection, testMysqlConnection } from '@/lib/mysql';
import { initializeFirebase } from '@/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { getMockCollection } from '@/lib/mock-db';
import { DataSource } from '@/lib/types';
import bcrypt from 'bcryptjs';

const collectionToTableMap: { [key: string]: string } = {
  users: 'users',
  platformUsers: 'platformUsers',
  groups: 'groups',
  entitlements: 'entitlements',
  resources: 'resources',
  assignments: 'assignments',
  tenants: 'tenants',
  auditEvents: 'auditEvents',
  jiraConfigs: 'jiraConfigs',
  bundles: 'bundles',
  servicePartners: 'servicePartners',
  smtpConfigs: 'smtpConfigs',
  aiConfigs: 'aiConfigs',
  syncJobs: 'syncJobs',
  helpContent: 'helpContent',
  risks: 'risks',
  riskMeasures: 'riskMeasures',
  riskReviews: 'riskReviews',
  riskCategorySettings: 'riskCategorySettings',
};

function normalizeRecord(item: any, tableName: string) {
  const normalized = { ...item };
  if (tableName === 'groups' || tableName === 'bundles') {
    normalized.entitlementConfigs = item.entitlementConfigs ? (typeof item.entitlementConfigs === 'string' ? JSON.parse(item.entitlementConfigs) : item.entitlementConfigs) : [];
    normalized.userConfigs = item.userConfigs ? (typeof item.userConfigs === 'string' ? JSON.parse(item.userConfigs) : item.userConfigs) : [];
    normalized.entitlementIds = item.entitlementIds ? (typeof item.entitlementIds === 'string' ? JSON.parse(item.entitlementIds) : item.entitlementIds) : [];
    normalized.userIds = item.userIds ? (typeof item.userIds === 'string' ? JSON.parse(item.userIds) : item.userIds) : [];
  }
  if (tableName === 'auditEvents') {
    normalized.before = item.before ? (typeof item.before === 'string' ? JSON.parse(item.before) : item.before) : null;
    normalized.after = item.after ? (typeof item.after === 'string' ? JSON.parse(item.after) : item.after) : null;
  }
  const boolFields = ['enabled', 'isAdmin', 'isSharedAccount', 'ldapEnabled'];
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
  if (!tableName) return { data: null, error: `Invalid collection: ${collectionName}` };
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
  if (!tableName) return { success: false, error: 'Invalid table' };
  let connection;
  try {
    connection = await getMysqlConnection();
    const preparedData = { ...data, id };
    if (tableName === 'groups' || tableName === 'bundles') {
      if (Array.isArray(preparedData.entitlementConfigs)) preparedData.entitlementConfigs = JSON.stringify(preparedData.entitlementConfigs);
      if (Array.isArray(preparedData.userConfigs)) preparedData.userConfigs = JSON.stringify(preparedData.userConfigs);
      if (Array.isArray(preparedData.entitlementIds)) preparedData.entitlementIds = JSON.stringify(preparedData.entitlementIds);
      if (Array.isArray(preparedData.userIds)) preparedData.userIds = JSON.stringify(preparedData.userIds);
    }
    if (tableName === 'auditEvents') {
      if (preparedData.before && typeof preparedData.before === 'object') preparedData.before = JSON.stringify(preparedData.before);
      if (preparedData.after && typeof preparedData.after === 'object') preparedData.after = JSON.stringify(preparedData.after);
    }
    const boolKeys = ['enabled', 'isAdmin', 'isSharedAccount', 'ldapEnabled'];
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

export async function testMysqlConnectionAction(): Promise<{ success: boolean; message: string; }> {
    return await testMysqlConnection();
}
