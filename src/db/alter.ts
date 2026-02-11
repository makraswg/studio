
import { getMysqlConnection } from '../lib/mysql';

async function alterTable() {
  let connection;
  try {
    connection = await getMysqlConnection();
    console.log('Connected to MySQL database.');

    const alterTableQuery = `
      ALTER TABLE \`users\`
      ADD COLUMN \`department\` VARCHAR(255) NULL;
    `;

    await connection.execute(alterTableQuery);
    console.log('Table \`users\` altered successfully.');

  } catch (error: any) {
    console.error('Error altering table:', error.message);
  } finally {
    if (connection) {
      connection.release();
      console.log('MySQL connection released.');
    }
  }
}

alterTable();
