'use server';

import { getPool, dbQuery } from '@/lib/mysql';
import { appSchema } from '@/lib/schema';
import bcrypt from 'bcryptjs';
import { logAuditEventAction } from './audit-actions';

/**
 * Prüft den Systemstatus. 
 * Das System gilt als initialisiert, wenn die Tabelle platformUsers existiert und mindestens ein Admin vorhanden ist.
 */
export async function checkSystemStatusAction(): Promise<{ initialized: boolean }> {
  let connection: any = null;
  try {
    const pool = getPool();
    connection = await pool.getConnection();
    const dbName = connection.config.database;

    // Prüfen ob Tabelle existiert
    const [tableExists]: any = await connection.query(
      "SELECT count(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'platformUsers'",
      [dbName]
    );

    if (tableExists[0].count === 0) return { initialized: false };

    // Prüfen ob mindestens ein Admin existiert
    const [rows]: any = await connection.query('SELECT count(*) as count FROM `platformUsers`');
    return { initialized: rows[0].count > 0 };
  } catch (e) {
    return { initialized: false };
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Führt die Migration durch. 
 * Erstellt fehlende Tabellen und fügt fehlende Spalten zu bestehenden Tabellen hinzu.
 */
export async function runDatabaseMigrationAction(): Promise<{ success: boolean; message: string; details: string[] }> {
  const details: string[] = [];
  let connection: any = null;
  try {
    const pool = getPool();
    connection = await pool.getConnection();
    const dbName = connection.config.database;

    details.push(`✅ Datenbank '${dbName}' verbunden.`);

    for (const tableName of Object.keys(appSchema)) {
      const tableDefinition = appSchema[tableName];
      const [tableExistsResult]: any = await connection.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`,
        [dbName, tableName]
      );

      if (tableExistsResult.length === 0) {
        // Tabelle existiert gar nicht -> Neu anlegen
        const columnsSql = Object.entries(tableDefinition.columns)
          .map(([colName, colDef]) => `\`${colName}\` ${colDef}`)
          .join(', \n');
        details.push(`🏃 Erstelle neue Tabelle '${tableName}'...`);
        await connection.query(`CREATE TABLE \`${tableName}\` (\n${columnsSql}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
      } else {
        // Tabelle existiert -> Spalten vergleichen
        for (const columnName of Object.keys(tableDefinition.columns)) {
          const [colRes]: any = await connection.query(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND LOWER(column_name) = LOWER(?)`,
            [dbName, tableName, columnName]
          );
          
          if (colRes.length === 0) {
            // Spalte fehlt -> ALTER TABLE
            details.push(`✨ Erweitere '${tableName}': Neue Spalte '${columnName}' erkannt.`);
            await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${tableDefinition.columns[columnName]}`);
          }
        }
      }
    }

    const successMsg = details.length > 1 ? 'Datenbank-Struktur erfolgreich aktualisiert.' : 'Datenbank ist bereits auf dem neuesten Stand.';
    return { success: true, message: successMsg, details };
  } catch (error: any) {
    console.error("Migration failed:", error);
    return { success: false, message: `Migrationsfehler: ${error.message}`, details };
  } finally {
    if (connection) connection.release();
  }
}

/**
 * Erstellt den ersten Administrator, den Standard-Mandanten und die SuperAdmin-Rolle.
 * Zudem werden die System-Prozesstypen initialisiert.
 */
export async function createInitialAdminAction(data: { 
  name: string, 
  email: string, 
  password: string,
  tenantName: string 
}): Promise<{ success: boolean; message: string }> {
  let connection: any = null;
  try {
    const pool = getPool();
    connection = await pool.getConnection();

    console.log("[SETUP] Starte Initialisierung...");

    // 1. Mandant erstellen
    const tenantId = 't1';
    await connection.query(
      'INSERT INTO `tenants` (id, name, slug, createdAt, status) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)', 
      [tenantId, data.tenantName, data.tenantName.toLowerCase().replace(/[^a-z0-9]/g, '-'), new Date().toISOString(), 'active']
    );

    // 2. Standardrolle superAdmin initialisieren (als Datenbank-Datensatz für die GUI)
    const superAdminRole = {
      id: 'superAdmin',
      name: 'Super Administrator',
      description: 'Systemweite Vollberechtigung (Initial erstellt).',
      permissions: JSON.stringify({
        iam: 'write',
        risks: 'write',
        processhub: 'write',
        gdpr: 'write',
        settings: 'write',
        audit: 'write',
        media: 'write'
      })
    };

    await connection.query(
      'INSERT INTO `platformRoles` (id, name, description, permissions) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), permissions = VALUES(permissions)',
      [superAdminRole.id, superAdminRole.name, superAdminRole.description, superAdminRole.permissions]
    );

    // 3. System-Prozesstypen initialisieren
    const systemProcessTypes = [
      { id: 'pt-corp', name: 'Unternehmensprozess', desc: 'Strategische und organisatorische Abläufe.' },
      { id: 'pt-detail', name: 'Detailprozess / Leitfaden', desc: 'Operative Arbeitsanweisungen.' },
      { id: 'pt-backup', name: 'IT-Sicherung (Backup)', desc: 'Prozesse zur Datensicherung und Wiederherstellung.' },
      { id: 'pt-update', name: 'Wartung & Patching', desc: 'Prozesse zur Softwareaktualisierung.' }
    ];

    for (const pt of systemProcessTypes) {
      await connection.query(
        'INSERT INTO `process_types` (id, name, description, enabled, createdAt) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
        [pt.id, pt.name, pt.desc, 1, new Date().toISOString()]
      );
    }

    // 4. Admin erstellen
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(data.password, salt);
    const adminId = 'puser-initial-admin';
    
    await connection.query(
      'INSERT INTO `platformUsers` (id, email, password, displayName, role, tenantId, enabled, createdAt, authSource) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE email = VALUES(email), password = VALUES(password)',
      [adminId, data.email, hashedPassword, data.name, 'superAdmin', 'all', 1, new Date().toISOString(), 'local']
    );

    // 5. Audit Log für Setup
    await logAuditEventAction('mysql', {
      tenantId: 'global',
      actorUid: data.email,
      action: 'System-Initialisierung und erster Administrator angelegt.',
      entityType: 'system',
      entityId: 'setup'
    });

    return { success: true, message: 'Setup erfolgreich abgeschlossen.' };
  } catch (error: any) {
    console.error("[SETUP-ERROR]", error);
    return { success: false, message: `Setup-Fehler: ${error.message}` };
  } finally {
    if (connection) connection.release();
  }
}
