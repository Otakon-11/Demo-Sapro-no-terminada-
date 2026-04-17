const { pool } = require('./db.js');
async function querySchema() {
  try {
    const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'gasto';");
    console.log("GASTO:", res.rows);
    const res2 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'concepto_gasto';");
    console.log("CONCEPTO:", res2.rows);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
querySchema();
