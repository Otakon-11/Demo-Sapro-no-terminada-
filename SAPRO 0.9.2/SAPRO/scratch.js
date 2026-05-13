const { query } = require('./server/db');
(async () => {
  try {
    const res = await query('SELECT * FROM Proyecto LIMIT 1');
    console.log(res);
    const res2 = await query('SELECT * FROM Clientes LIMIT 1');
    console.log(res2);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();
