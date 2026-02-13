
import mysql from 'mysql2/promise';

/**
 * Zentrales MySQL Connection Pooling (Singleton).
 * Optimiert nach Enterprise-Best-Practices zur Vermeidung von Leaks.
 */
let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (pool) return pool;

  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = Number(process.env.MYSQL_PORT || (host === 'compliance-db' ? 3306 : 3307));
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || 'rootpassword';
  const database = process.env.MYSQL_DATABASE || 'compliance_hub';

  console.log(`[MySQL] Initialisiere Pool: ${host}:${port} (DB: ${database})`);

  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 30, // Ausreichend Kapazität für parallele Requests
    maxIdle: 10,
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 10000, // 10s Timeout für den Verbindungsaufbau
    dateStrings: true // Verhindert JS-Date Konvertierungsfehler
  });
  
  return pool;
}

/**
 * Hilfsfunktion für sichere Abfragen ohne manuelles Connection-Handling.
 * Nutzt pool.execute(), was die Verbindung automatisch freigibt.
 */
export async function dbQuery(sql: string, params: any[] = []) {
  const start = Date.now();
  const pool = getPool();
  try {
    const [rows] = await pool.execute(sql, params);
    const duration = Date.now() - start;
    if (duration > 500) {
      console.warn(`[DB-TRACE] Slow Query (${duration}ms): ${sql.substring(0, 100)}...`);
    }
    return rows;
  } catch (error: any) {
    console.error(`[DB-ERROR] (${sql.substring(0, 50)}...):`, error.message);
    throw error;
  }
}

/**
 * Schneller Ping-Test für das Setup/Status-Monitoring.
 */
export async function testMysqlConnection() {
  try {
    const pool = getPool();
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return { success: true, message: "MySQL Verbindung stabil." };
  } catch (error: any) {
    return { success: false, message: `Verbindungsfehler: ${error.message}` };
  }
}
