const { query } = require('./server/db');

async function showTables() {
  try {
    const res = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    console.log(res);
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}

showTables();
