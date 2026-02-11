import mysql from 'mysql2/promise';

// Wichtiger Hinweis: Die Zugangsdaten werden aus Umgebungsvariablen geladen.
// Stellen Sie sicher, dass eine .env.local-Datei im Hauptverzeichnis des Projekts existiert.

let pool: mysql.Pool | null = null;

function getPool() {
  if (pool) {
    return pool;
  }

  try {
    // Docker-Spezifische Korrektur: 
    // Wenn die App im Container läuft, ist '127.0.0.1' falsch für die DB.
    // '3307' ist der Host-Mapping Port, intern im Docker-Netzwerk ist es fast immer '3306'.
    let host = process.env.MYSQL_HOST || '127.0.0.1';
    let port = Number(process.env.MYSQL_PORT || 3306);

    // Automatisches Fallback für Docker-Umgebungen
    const isDocker = process.env.MYSQL_HOST === 'compliance-db';
    
    // Falls wir 127.0.0.1 und Port 3307 sehen (typisch für lokale Entwicklung außerhalb Docker),
    // aber wir wissen, dass wir eigentlich zum Service 'compliance-db' wollen:
    if (host === '127.0.0.1' && port === 3307) {
       console.log("[MySQL] Port 3307 auf 127.0.0.1 erkannt. Falls dies ein Docker-Container ist, wird die Verbindung fehlschlagen.");
    }

    console.log(`[MySQL] Initialisiere Pool: ${host}:${port} (DB: ${process.env.MYSQL_DATABASE})`);

    pool = mysql.createPool({
      host: host,
      port: port,
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000, // 10s Timeout für bessere Fehlermeldungen
    });
    
    return pool;

  } catch (error) {
    console.error("Failed to create MySQL connection pool:", error);
    return null;
  }
}

export async function getMysqlConnection() {
  const pool = getPool();
  if (!pool) {
    throw new Error("MySQL connection pool is not available. Check configuration.");
  }
  return pool.getConnection();
}

export async function testMysqlConnection() {
  let connection;
  try {
    connection = await getMysqlConnection();
    await connection.ping();
    return { success: true, message: "MySQL Verbindung erfolgreich etabliert." };
  } catch (error: any) {
    console.error("MySQL connection test failed:", error);
    
    // Hilfreiche Tipps für den Benutzer bei Connection Errors
    let hint = "";
    if (error.code === 'ECONNREFUSED') {
      hint = " (Tipp: Prüfen Sie ob MYSQL_HOST auf den Service-Namen 'compliance-db' zeigt und der Port intern '3306' ist)";
    }
    
    return { success: false, message: `Verbindungsfehler: ${error.message}${hint}` };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
