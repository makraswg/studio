
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

export async function runDatabaseMigrationAction(): Promise<{ success: boolean; message: string; details: string[] }> {
  const details: string[] = [];
  try {
    const pool = getPool();
    const connection: any = await pool.getConnection();
    const dbName = connection.config.database;
    connection.release();

    details.push(`✅ Datenbank '${dbName}' verbunden.`);

    for (const tableName of Object.keys(appSchema)) {
      const tableDefinition = appSchema[tableName];
      const [tableExistsResult]: any = await dbQuery(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`,
        [dbName, tableName]
      );

      if (tableExistsResult.length === 0) {
        const columnsSql = Object.entries(tableDefinition.columns)
          .map(([colName, colDef]) => `\`${colName}\` ${colDef}`)
          .join(', \n');
        details.push(`🏃 Erstelle Tabelle '${tableName}'...`);
        await dbQuery(`CREATE TABLE \`${tableName}\` (\n${columnsSql}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
      } else {
        for (const columnName of Object.keys(tableDefinition.columns)) {
          const [colRes]: any = await dbQuery(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND LOWER(column_name) = LOWER(?)`,
            [dbName, tableName, columnName]
          );
          if (colRes.length === 0) {
            details.push(`🏃 Füge Spalte '${columnName}' zu '${tableName}' hinzu...`);
            await dbQuery(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${tableDefinition.columns[columnName]}`);
          }
        }
      }
    }

    // Default Seedings
    const tenantRows: any = await dbQuery('SELECT COUNT(*) as count FROM `tenants`');
    if (tenantRows[0].count === 0) {
      await dbQuery('INSERT INTO `tenants` (id, name, slug, createdAt, status) VALUES (?, ?, ?, ?, ?)', 
        ['t1', 'Meine Organisation', 'meine-organisation', new Date().toISOString(), 'active']);
      details.push('🌱 Standard-Mandant erstellt.');
    }

    const adminRows: any = await dbQuery('SELECT COUNT(*) as count FROM `platformUsers`');
    if (adminRows[0].count === 0) {
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync('admin123', salt);
      await dbQuery('INSERT INTO `platformUsers` (id, email, password, displayName, role, tenantId, enabled, createdAt, authSource) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['puser-admin', 'admin@compliance-hub.local', hashedPassword, 'Plattform Admin', 'superAdmin', 'all', 1, new Date().toISOString(), 'local']);
      details.push('🌱 Admin-Konto erstellt (admin123).');
    }

    return { success: true, message: 'Integrität bestätigt.', details };
  } catch (error: any) {
    console.error("Migration failed:", error);
    return { success: false, message: error.message, details };
  }
}
