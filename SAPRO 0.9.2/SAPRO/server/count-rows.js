const { query } = require('./db');
async function main() {
    const p = await query('SELECT COUNT(*) FROM Proyecto');
    const i = await query('SELECT COUNT(*) FROM Ingresos');
    console.log("Proyectos:", p[0].count);
    console.log("Ingresos:", i[0].count);
    process.exit(0);
}
main();
