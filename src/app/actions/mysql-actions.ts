'use server';

import { getMysqlConnection, testMysqlConnection } from '@/lib/mysql';

// Eine einfache Zuordnung von Anwendungs-Sammlungsnamen zu echten MySQL-Tabellennamen.
// Dies ist eine Sicherheitsebene, um willkürliche Tabellenabfragen zu verhindern.
const collectionToTableMap: { [key: string]: string } = {
  users: 'users',
  groups: 'groups',
  entitlements: 'entitlements',
  resources: 'resources',
  assignments: 'assignments',
};

/**
 * Führt eine sichere Leseoperation auf einer MySQL-Tabelle aus.
 * Diese Funktion wird immer auf dem Server ausgeführt und schützt die Datenbank-Zugangsdaten.
 * @param collectionName Der logische Name der Sammlung (z.B. 'users').
 * @returns Ein Objekt mit den Daten oder einer Fehlermeldung.
 */
export async function getCollectionData(collectionName: string): Promise<{ data: any[] | null; error: string | null; }> {
  const tableName = collectionToTableMap[collectionName];

  // Wenn der Sammlungsname nicht in unserer Zuordnung existiert, wird die Anfrage abgelehnt.
  if (!tableName) {
    console.warn(`Attempted to query an invalid collection: ${collectionName}`);
    return { data: null, error: `Die Sammlung '${collectionName}' ist nicht für den Zugriff freigegeben.` };
  }

  let connection;
  try {
    // Baut die Verbindung zur Datenbank auf.
    connection = await getMysqlConnection();
    
    // Führt die SQL-Abfrage aus. 'SELECT *' ist hier sicher, da wir den Tabellennamen validiert haben.
    const [rows] = await connection.execute(`SELECT * FROM \`${tableName}\``);

    // Gibt die Verbindung sofort wieder an den Pool zurück.
    connection.release();
    
    // Konvertiert das Ergebnis in ein einfaches JSON-Format.
    const data = JSON.parse(JSON.stringify(rows));
    
    return { data, error: null };

  } catch (error: any) {
    console.error(`MySQL query failed for table '${tableName}':`, error);
    // Stellt sicher, dass die Verbindung auch im Fehlerfall freigegeben wird.
    if (connection) {
      connection.release();
    }
    return { data: null, error: `Datenbankfehler: ${error.message}` };
  }
}

/**
 * Führt einen sicheren Verbindungstest für MySQL aus.
 * Wird auf dem Server ausgeführt und gibt nur das Ergebnis an den Client zurück.
 */
export async function testMysqlConnectionAction(): Promise<{ success: boolean; message: string; }> {
    return await testMysqlConnection();
}
