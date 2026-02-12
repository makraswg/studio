
import mysql from 'mysql2/promise';

// Wichtiger Hinweis: Die Zugangsdaten werden aus Umgebungsvariablen geladen.
// Stellen Sie sicher, dass eine .env-Datei im Root-Verzeichnis existiert.

let pool: mysql.Pool | null = null;

function getPool() {
  if (pool) {
    return pool;
  }

  try {
    let host = process.env.MYSQL_HOST || '127.0.0.1';
    let port = Number(process.env.MYSQL_PORT || 3306);

    // Docker-Spezifische Korrektur:
    // Wenn als Host 'compliance-db' (der Service-Name im Docker-Netzwerk) angegeben ist,
    // muss intern IMMER Port 3306 verwendet werden, selbst wenn in der .env der externe
    // Mapping-Port 3307 eingetragen ist.
    if (host === 'compliance-db' && port === 3307) {
      console.log("[MySQL] Interner Docker-Zugriff erkannt. Korrigiere Port 3307 auf 3306.");
      port = 3306;
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
      connectTimeout: 10000,
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
    let hint = "";
    if (error.code === 'ECONNREFUSED') {
      hint = " (Tipp: Stellen Sie sicher, dass MYSQL_HOST auf den Service-Namen 'compliance-db' zeigt und intern Port 3306 nutzt)";
    }
    return { success: false, message: `Verbindungsfehler: ${error.message}${hint}` };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
