
'use server';

import { getPool, dbQuery } from '@/lib/mysql';
import { appSchema } from '@/lib/schema';
import bcrypt from 'bcryptjs';

export async function checkSystemStatusAction(): Promise<{ initialized: boolean }> {
  try {
    const rows: any = await dbQuery('SELECT 1 FROM `tenants` LIMIT 1');
    return { initialized: rows.length > 0 };
  } catch (e) {
    return { initialized: false };
  }
}

/**
 * Führt die Datenbank-Initialisierung durch.
 * Nutzt sauberes Connection-Handling mit release() in finally.
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
        const columnsSql = Object.entries(tableDefinition.columns)
          .map(([colName, colDef]) => `\`${colName}\` ${colDef}`)
          .join(', \n');
        details.push(`🏃 Erstelle Tabelle '${tableName}'...`);
        await connection.query(`CREATE TABLE \`${tableName}\` (\n${columnsSql}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
      } else {
        for (const columnName of Object.keys(tableDefinition.columns)) {
          const [colRes]: any = await connection.query(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND LOWER(column_name) = LOWER(?)`,
            [dbName, tableName, columnName]
          );
          if (colRes.length === 0) {
            details.push(`🏃 Füge Spalte '${columnName}' zu '${tableName}' hinzu...`);
            await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${tableDefinition.columns[columnName]}`);
          }
        }
      }
    }

    // Default Seedings
    const [tenantRows]: any = await connection.query('SELECT COUNT(*) as count FROM `tenants`');
    if (tenantRows[0].count === 0) {
      await connection.query('INSERT INTO `tenants` (id, name, slug, createdAt, status) VALUES (?, ?, ?, ?, ?)', 
        ['t1', 'Meine Organisation', 'meine-organisation', new Date().toISOString(), 'active']);
      details.push('🌱 Standard-Mandant erstellt.');
    }

    const [adminRows]: any = await connection.query('SELECT COUNT(*) as count FROM `platformUsers`');
    if (adminRows[0].count === 0) {
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync('admin123', salt);
      await connection.query('INSERT INTO `platformUsers` (id, email, password, displayName, role, tenantId, enabled, createdAt, authSource) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['puser-admin', 'admin@compliance-hub.local', hashedPassword, 'Plattform Admin', 'superAdmin', 'all', 1, new Date().toISOString(), 'local']);
      details.push('🌱 Admin-Konto erstellt (admin123).');
    }

    return { success: true, message: 'Integrität bestätigt.', details };
  } catch (error: any) {
    console.error("Migration failed:", error);
    return { success: false, message: error.message, details };
  } finally {
    if (connection) connection.release(); // CRITICAL: Freigabe der Verbindung
  }
}
