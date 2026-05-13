const { pool, query } = require('./server/db');

async function checkConnection() {
  try {
    const res = await query('SELECT NOW() AS current_time');
    console.log('✅ Conexión exitosa a la base de datos PostgreSQL.');
    console.log('Hora del servidor de base de datos:', res[0].current_time);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al conectar a la base de datos:');
    console.error(error.message);
    process.exit(1);
  }
}

checkConnection();
