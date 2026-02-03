'use server';

import { getMysqlConnection } from '@/lib/mysql';
import { appSchema } from '@/lib/schema';
import { PoolConnection } from 'mysql2/promise';

/**
 * Führt eine Datenbank-Migration basierend auf dem definierten App-Schema durch.
 * Diese Funktion ist idempotent und kann sicher mehrfach ausgeführt werden.
 * Sie erstellt Tabellen und fügt Spalten hinzu, löscht aber nichts.
 */
export async function runDatabaseMigrationAction(): Promise<{ success: boolean; message: string; details: string[] }> {
  let connection: PoolConnection | undefined;
  const details: string[] = []; // Sammelt detaillierte Log-Meldungen

  try {
    connection = await getMysqlConnection();
    details.push('✅ Erfolgreich mit der Datenbank verbunden.');

    const dbName = (connection as any).config.database;
    if (!dbName) {
        throw new Error('Kein Datenbankname in der Verbindungskonfiguration gefunden.');
    }

    for (const tableName of Object.keys(appSchema)) {
      const tableDefinition = appSchema[tableName];

      // 1. Prüfen, ob die Tabelle existiert
      const [tableExistsResult] = await connection.execute(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`,
        [dbName, tableName]
      );

      const tableExists = (tableExistsResult as any[]).length > 0;

      if (!tableExists) {
        // 2a. Tabelle existiert nicht -> Erstellen
        const columnsSql = Object.entries(tableDefinition.columns)
          .map(([colName, colDef]) => `\`${colName}\` ${colDef}`)
          .join(', \n');
        const createTableSql = `CREATE TABLE \`${tableName}\` (\n${columnsSql}\n);`;
        
        details.push(`🏃 Tabelle '${tableName}' nicht gefunden, wird erstellt...`);
        await connection.execute(createTableSql);
        details.push(`   ✅ Tabelle '${tableName}' erfolgreich erstellt.`);

      } else {
        // 2b. Tabelle existiert -> Spalten prüfen
        details.push(`🔍 Tabelle '${tableName}' existiert, prüfe Spalten...`);

        for (const columnName of Object.keys(tableDefinition.columns)) {
          const columnDefinition = tableDefinition.columns[columnName];

          // Prüfen, ob die Spalte existiert
          const [columnExistsResult] = await connection.execute(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
            [dbName, tableName, columnName]
          );

          const columnExists = (columnExistsResult as any[]).length > 0;

          if (!columnExists) {
            // Spalte existiert nicht -> Hinzufügen
            const addColumnSql = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDefinition}`;
            
            details.push(`   🏃 Spalte '${columnName}' in '${tableName}' nicht gefunden, wird hinzugefügt...`);
            await connection.execute(addColumnSql);
            details.push(`      ✅ Spalte '${columnName}' erfolgreich hinzugefügt.`);
          } else {
             details.push(`   ✔️ Spalte '${columnName}' existiert bereits.`);
          }
        }
      }
    }

    connection.release();
    return { 
        success: true, 
        message: 'Datenbank-Migration erfolgreich abgeschlossen.',
        details
    };

  } catch (error: any) {
    if (connection) {
      connection.release();
    }
    console.error("Database migration failed:", error);
    details.push(`❌ Fehler: ${error.message}`);
    return { 
        success: false, 
        message: `Datenbank-Migration fehlgeschlagen: ${error.message}`,
        details
    };
  }
}
