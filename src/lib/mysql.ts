
import mysql from 'mysql2/promise';

// Wichtiger Hinweis: Die Zugangsdaten werden aus Umgebungsvariablen geladen.
// Stellen Sie sicher, dass eine .env.local-Datei im Hauptverzeichnis des Projekts existiert.
// Beispiel für .env.local:
// MYSQL_HOST=127.0.0.1
// MYSQL_PORT=3306
// MYSQL_DATABASE=meine_db
// MYSQL_USER=mein_user
// MYSQL_PASSWORD=mein_passwort

let pool: mysql.Pool | null = null;

function getPool() {
  if (pool) {
    return pool;
  }

  try {
    console.log("Creating new MySQL connection pool...");
    // Erstellt einen neuen Verbindungs-Pool mit den Daten aus den Umgebungsvariablen
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT || 3306),
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      waitForConnections: true,
      connectionLimit: 10, // Maximale Anzahl an Verbindungen im Pool
      queueLimit: 0, // Unbegrenzte Warteschlange, wenn alle Verbindungen in Benutzung sind
    });
    
    console.log("MySQL connection pool created successfully.");
    return pool;

  } catch (error) {
    console.error("Failed to create MySQL connection pool:", error);
    // Wenn die Pool-Erstellung fehlschlägt, geben wir null zurück und loggen den Fehler.
    // Die Anwendung wird nicht abstürzen, aber Datenbankoperationen werden fehlschlagen.
    return null;
  }
}

// Hauptfunktion, die eine Verbindung aus dem Pool holt.
// Dies ist die Funktion, die der Rest der Anwendung verwenden wird.
export async function getMysqlConnection() {
  const pool = getPool();
  if (!pool) {
    // Wenn der Pool nicht erstellt werden konnte, wird eine klare Fehlermeldung geworfen.
    throw new Error("MySQL connection pool is not available. Please check your configuration and environment variables.");
  }
  return pool.getConnection();
}

// Eine Testfunktion, um die Verbindung zu pingen und zu überprüfen.
// Sie holt eine Verbindung und gibt sie sofort wieder frei.
export async function testMysqlConnection() {
  let connection;
  try {
    // Versucht, eine Verbindung aus dem Pool zu erhalten.
    connection = await getMysqlConnection();
    // Führt einen einfachen Ping an die Datenbank aus.
    await connection.ping();
    return { success: true, message: "MySQL connection successful." };
  } catch (error: any) {
    console.error("MySQL connection test failed:", error);
    // Gibt detaillierte Fehlermeldungen zurück, um die Fehlersuche zu erleichtern.
    return { success: false, message: error.message };
  } finally {
    // Gibt die Verbindung nach dem Test wieder an den Pool zurück.
    if (connection) {
      connection.release();
    }
  }
}
