
import mysql from 'mysql2/promise';

// Die Zugangsdaten werden direkt aus den Umgebungsvariablen (.env) geladen.
let pool: mysql.Pool | null = null;

function getPool() {
  if (pool) {
    return pool;
  }

  try {
    const host = process.env.MYSQL_HOST || '127.0.0.1';
    let port = Number(process.env.MYSQL_PORT || 3306);
    const database = process.env.MYSQL_DATABASE;
    const user = process.env.MYSQL_USER;
    const password = process.env.MYSQL_PASSWORD;

    // Intelligent Docker Port Recognition:
    // If we are connecting to the internal docker service 'compliance-db',
    // we MUST use the internal port 3306, regardless of external mappings.
    if (host === 'compliance-db' || host === 'compliance-hub-db') {
      port = 3306;
    }

    pool = mysql.createPool({
      host,
      port,
      database,
      user,
      password,
      waitForConnections: true,
      connectionLimit: 20, // Erhöht für bessere Performance bei vielen parallelen Requests
      queueLimit: 0,
      connectTimeout: 15000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
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
    return { success: false, message: `Verbindungsfehler: ${error.message}` };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
