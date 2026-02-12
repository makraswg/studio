
'use server';

import { getMysqlConnection } from '@/lib/mysql';
import { appSchema } from '@/lib/schema';
import { PoolConnection } from 'mysql2/promise';
import bcrypt from 'bcryptjs';

/**
 * Führt eine Datenbank-Migration basierend auf dem definierten App-Schema durch.
 * Diese Funktion ist idempotent und kann sicher mehrfach ausgeführt werden.
 */
export async function runDatabaseMigrationAction(): Promise<{ success: boolean; message: string; details: string[] }> {
  let connection: PoolConnection | undefined;
  const details: string[] = [];

  try {
    connection = await getMysqlConnection();
    details.push('✅ Erfolgreich mit der Datenbank verbunden.');

    const dbName = (connection as any).config.database;
    if (!dbName) {
        throw new Error('Kein Datenbankname in der Verbindungskonfiguration gefunden.');
    }

    for (const tableName of Object.keys(appSchema)) {
      const tableDefinition = appSchema[tableName];

      const [tableExistsResult] = await connection.execute(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`,
        [dbName, tableName]
      );

      const tableExists = (tableExistsResult as any[]).length > 0;

      if (!tableExists) {
        const columnsSql = Object.entries(tableDefinition.columns)
          .map(([colName, colDef]) => `\`${colName}\` ${colDef}`)
          .join(', \n');
        const createTableSql = `CREATE TABLE \`${tableName}\` (\n${columnsSql}\n);`;
        
        details.push(`🏃 Tabelle '${tableName}' nicht gefunden, wird erstellt...`);
        await connection.execute(createTableSql);
        details.push(`   ✅ Tabelle '${tableName}' erfolgreich erstellt.`);

      } else {
        details.push(`🔍 Tabelle '${tableName}' existiert, prüfe Spalten...`);

        for (const columnName of Object.keys(tableDefinition.columns)) {
          const columnDefinition = tableDefinition.columns[columnName];

          const [columnExistsResult] = await connection.execute(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND LOWER(column_name) = LOWER(?)`,
            [dbName, tableName, columnName]
          );

          const columnExists = (columnExistsResult as any[]).length > 0;

          if (!columnExists) {
            const addColumnSql = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDefinition}`;
            details.push(`   🏃 Spalte '${columnName}' in '${tableName}' nicht gefunden, wird hinzugefügt...`);
            await connection.execute(addColumnSql);
            details.push(`      ✅ Spalte '${columnName}' erfolgreich hinzugefügt.`);
          }
        }
      }
    }

    // SEEDING: Default Tenant
    details.push('🌱 Prüfe auf Organisationen...');
    const [tenantRows]: any = await connection.execute('SELECT COUNT(*) as count FROM `tenants`');
    if (tenantRows[0].count === 0) {
      const now = new Date().toISOString();
      await connection.execute(
        'INSERT INTO `tenants` (id, name, slug, createdAt, status, region) VALUES (?, ?, ?, ?, ?, ?)',
        ['t1', 'Meine Organisation', 'meine-organisation', now, 'active', 'EU-DSGVO']
      );
      details.push('   ✅ Initialer Mandant erstellt. Sie können diesen in den Einstellungen umbenennen.');
    }

    // SEEDING: Prozesstypen
    details.push('🌱 Prüfe auf Prozesstypen...');
    const [typeRows]: any = await connection.execute('SELECT COUNT(*) as count FROM `process_types`');
    if (typeRows[0].count === 0) {
      const types = [
        ['pt-corp', 'Unternehmensprozess', 'Strategische und übergeordnete Geschäftsprozesse', 1, new Date().toISOString()],
        ['pt-detail', 'Detailprozess', 'Operative Arbeitsabläufe und Handlungsschritte', 1, new Date().toISOString()],
        ['pt-backup', 'Backup-Prozess', 'Technische Leitfäden zur Datensicherung und Wiederherstellung', 1, new Date().toISOString()],
        ['pt-update', 'Update-Prozess', 'Verfahrensanweisungen für Patching und Software-Wartung', 1, new Date().toISOString()]
      ];
      for (const t of types) {
        await connection.execute('INSERT INTO `process_types` (id, name, description, enabled, createdAt) VALUES (?, ?, ?, ?, ?)', t);
      }
      details.push('   ✅ System-Prozesstypen erstellt.');
    }

    // SEEDING: Default Admin Account
    details.push('🌱 Prüfe auf initialen Admin-Account...');
    const [userRows]: any = await connection.execute('SELECT COUNT(*) as count FROM `platformUsers`');
    if (userRows[0].count === 0) {
      const adminId = 'puser-initial-admin';
      const adminEmail = 'admin@compliance-hub.local';
      const adminPassword = 'admin123';
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(adminPassword, salt);
      const now = new Date().toISOString();

      await connection.execute(
        'INSERT INTO `platformUsers` (id, email, password, displayName, role, tenantId, enabled, createdAt, authSource) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [adminId, adminEmail, hashedPassword, 'Plattform Admin', 'superAdmin', 'all', 1, now, 'local']
      );
      details.push(`   ✅ Initialer Admin erstellt: ${adminEmail} (Passwort: ${adminPassword})`);
    }

    connection.release();
    return { success: true, message: 'Migration erfolgreich abgeschlossen.', details };

  } catch (error: any) {
    if (connection) connection.release();
    console.error("Database migration failed:", error);
    return { success: false, message: `Fehler: ${error.message}`, details: details };
  }
}
