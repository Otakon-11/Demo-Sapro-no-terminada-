const { query } = require('./server/db');
(async () => {
  try {
    const rows = await query(`
      SELECT c.Cli_ID_Cliente AS id, c.Cli_Nombre AS cliente,
             COUNT(p.Pro_ID_Proyecto)              AS proyectos,
             SUM(p.Pro_Costo_Proyecto)             AS costoTotal,
             SUM(COALESCE(i.total_ing, 0))         AS totalIngresos
      FROM Clientes c
      LEFT JOIN Proyecto p ON p.Cli_ID_Cliente = c.Cli_ID_Cliente
      LEFT JOIN (
        SELECT Pro_ID_Proyecto, SUM(Ing_Monto) AS total_ing FROM Ingresos GROUP BY Pro_ID_Proyecto
      ) i ON i.Pro_ID_Proyecto = p.Pro_ID_Proyecto
      GROUP BY c.Cli_ID_Cliente, c.Cli_Nombre
      ORDER BY proyectos DESC, costoTotal DESC`);
    console.log(rows);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();
