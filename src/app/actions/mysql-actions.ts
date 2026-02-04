
'use server';

import { getMysqlConnection, testMysqlConnection } from '@/lib/mysql';
import bcrypt from 'bcryptjs';

// Eine einfache Zuordnung von Anwendungs-Sammlungsnamen zu echten MySQL-Tabellennamen.
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
};

/**
 * Führt eine sichere Leseoperation auf einer MySQL-Tabelle aus.
 */
export async function getCollectionData(collectionName: string): Promise<{ data: any[] | null; error: string | null; }> {
  const tableName = collectionToTableMap[collectionName];

  if (!tableName) {
    return { data: null, error: `Die Sammlung '${collectionName}' ist nicht für den Zugriff freigegeben.` };
  }

  let connection;
  try {
    connection = await getMysqlConnection();
    const [rows] = await connection.execute(`SELECT * FROM \`${tableName}\``);
    connection.release();
    
    let data = JSON.parse(JSON.stringify(rows));
    
    // JSON-Felder für spezifische Tabellen parsen
    if (tableName === 'groups' || tableName === 'bundles') {
      data = data.map((item: any) => ({
        ...item,
        entitlementIds: item.entitlementIds ? (typeof item.entitlementIds === 'string' ? JSON.parse(item.entitlementIds) : item.entitlementIds) : [],
        userIds: item.userIds ? (typeof item.userIds === 'string' ? JSON.parse(item.userIds) : item.userIds) : [],
      }));
    }

    if (tableName === 'auditEvents') {
      data = data.map((item: any) => ({
        ...item,
        before: item.before ? (typeof item.before === 'string' ? JSON.parse(item.before) : item.before) : null,
        after: item.after ? (typeof item.after === 'string' ? JSON.parse(item.after) : item.after) : null,
      }));
    }

    // Security: Passwörter niemals an das Frontend schicken
    if (tableName === 'platformUsers') {
      data = data.map((u: any) => {
        const { password, ...rest } = u;
        return rest;
      });
    }
    
    return { data, error: null };

  } catch (error: any) {
    console.error(`MySQL query failed for table '${tableName}':`, error);
    if (connection) {
      connection.release();
    }
    return { data: null, error: `Datenbankfehler: ${error.message}` };
  }
}

/**
 * Speichert oder aktualisiert einen Datensatz in MySQL.
 */
export async function saveCollectionRecord(collectionName: string, id: string, data: any): Promise<{ success: boolean; error: string | null }> {
  const tableName = collectionToTableMap[collectionName];
  if (!tableName) return { success: false, error: 'Ungültige Tabelle' };

  let connection;
  try {
    connection = await getMysqlConnection();
    
    // Bereite Daten für MySQL vor (JSON-Felder konvertieren)
    const preparedData = { ...data, id };
    
    if (tableName === 'groups' || tableName === 'bundles') {
      if (Array.isArray(preparedData.entitlementIds)) preparedData.entitlementIds = JSON.stringify(preparedData.entitlementIds);
      if (Array.isArray(preparedData.userIds)) preparedData.userIds = JSON.stringify(preparedData.userIds);
    }

    if (tableName === 'auditEvents') {
      if (preparedData.before && typeof preparedData.before === 'object') preparedData.before = JSON.stringify(preparedData.before);
      if (preparedData.after && typeof preparedData.after === 'object') preparedData.after = JSON.stringify(preparedData.after);
    }

    // Security: Handle platform user passwords (hashing)
    if (tableName === 'platformUsers') {
      if (preparedData.password && preparedData.password.trim() !== '') {
        const isAlreadyHashed = /^\$2[ayb]\$.{56}$/.test(preparedData.password);
        if (!isAlreadyHashed) {
          const salt = bcrypt.genSaltSync(10);
          preparedData.password = bcrypt.hashSync(preparedData.password, salt);
        }
      } else {
        delete preparedData.password;
      }
    }

    // MySQL spezifische Boolean-Konvertierung
    if (preparedData.enabled !== undefined) preparedData.enabled = preparedData.enabled ? 1 : 0;
    if (preparedData.isAdmin !== undefined) preparedData.isAdmin = preparedData.isAdmin ? 1 : 0;
    if (preparedData.isSharedAccount !== undefined) preparedData.isSharedAccount = preparedData.isSharedAccount ? 1 : 0;
    if (preparedData.ldapEnabled !== undefined) preparedData.ldapEnabled = preparedData.ldapEnabled ? 1 : 0;
    if (preparedData.enabled === false) preparedData.enabled = 0; 

    const keys = Object.keys(preparedData);
    const values = Object.values(preparedData);
    
    const placeholders = keys.map(() => '?').join(', ');
    const updates = keys.map(key => `\`${key}\` = VALUES(\`${key}\`)`).join(', ');
    
    const sql = `INSERT INTO \`${tableName}\` (\`${keys.join('`, `')}\`) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`;
    
    await connection.execute(sql, values);
    connection.release();
    return { success: true, error: null };
  } catch (error: any) {
    console.error("MySQL Save Error:", error);
    if (connection) connection.release();
    return { success: false, error: error.message };
  }
}

/**
 * Aktualisiert das Passwort eines Plattform-Nutzers.
 */
export async function updatePlatformUserPasswordAction(email: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  if (!email || !newPassword) return { success: false, error: 'Daten unvollständig.' };

  let connection;
  try {
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(newPassword, salt);

    connection = await getMysqlConnection();
    await connection.execute(
      'UPDATE `platformUsers` SET `password` = ? WHERE `email` = ?',
      [hashedPassword, email]
    );
    connection.release();
    return { success: true };
  } catch (error: any) {
    if (connection) connection.release();
    return { success: false, error: error.message };
  }
}

/**
 * Löscht einen Datensatz aus MySQL.
 */
export async function deleteCollectionRecord(collectionName: string, id: string): Promise<{ success: boolean; error: string | null }> {
  const tableName = collectionToTableMap[collectionName];
  if (!tableName) return { success: false, error: 'Ungültige Tabelle' };

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

/**
 * Führt einen sicheren Verbindungstest für MySQL aus.
 */
export async function testMysqlConnectionAction(): Promise<{ success: boolean; message: string; }> {
    return await testMysqlConnection();
}
