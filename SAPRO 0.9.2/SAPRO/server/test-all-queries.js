const { query } = require('./db');

async function main() {
  try {
    const [
      projectStatusRows,
      commissionsRows,
      ingresosMesRows,
      projectIniciadosRows,
      projectTerminadosRows,
      clientesByTypeRows
    ] = await Promise.all([
      query(`
        SELECT e.Epr_Nombre_Estatus as name, COUNT(p.Pro_ID_Proyecto)::int as value
        FROM Estado_Proyecto e
        LEFT JOIN Proyecto p ON e.Epr_ID_Estatus_Proyecto = p.Epr_ID_Estatus_Proyecto
        GROUP BY e.Epr_Nombre_Estatus
      `),
      query(`
        SELECT e.Egs_Nombre as name, COALESCE(SUM(g.Gas_Monto), 0)::numeric as value
        FROM Estatus_Gasto e
        LEFT JOIN Gasto g ON g.Egs_ID_Estatus_Gasto = e.Egs_ID_Estatus_Gasto
        LEFT JOIN Concepto_Gasto c ON g.Cgs_ID_Concepto_Gasto = c.Cgs_ID_Concepto_Gasto AND c.Cgs_Nombre = 'Comisiones'
        GROUP BY e.Egs_Nombre
      `),
      query(`
        SELECT TO_CHAR(Ing_Fecha_Ingreso, 'TMMon') as month, SUM(Ing_Monto)::numeric as ventas
        FROM Ingresos
        GROUP BY TO_CHAR(Ing_Fecha_Ingreso, 'TMMon'), EXTRACT(MONTH FROM Ing_Fecha_Ingreso)
        ORDER BY EXTRACT(MONTH FROM Ing_Fecha_Ingreso)
      `),
      query(`
        SELECT TO_CHAR(Pro_Fecha_Inicio, 'TMMon') as month, COUNT(*)::int as iniciados, EXTRACT(MONTH FROM Pro_Fecha_Inicio) as m_order
        FROM Proyecto
        WHERE Pro_Fecha_Inicio IS NOT NULL
        GROUP BY TO_CHAR(Pro_Fecha_Inicio, 'TMMon'), EXTRACT(MONTH FROM Pro_Fecha_Inicio)
      `),
      query(`
        SELECT TO_CHAR(Pro_Fecha_Finalizacion, 'TMMon') as month, COUNT(*)::int as terminados, EXTRACT(MONTH FROM Pro_Fecha_Finalizacion) as m_order
        FROM Proyecto
        WHERE Pro_Fecha_Finalizacion IS NOT NULL
        GROUP BY TO_CHAR(Pro_Fecha_Finalizacion, 'TMMon'), EXTRACT(MONTH FROM Pro_Fecha_Finalizacion)
      `),
      query(`
        SELECT t.Tpc_Nombre as name, COUNT(c.Cli_ID_Cliente)::int as value
        FROM Tipo_Cliente t
        LEFT JOIN Clientes c ON t.Tpc_ID_Tipo_Cliente = c.Tpc_ID_Tipo_Cliente
        GROUP BY t.Tpc_Nombre
      `)
    ]);
    console.log("Success! Data loaded.");
    process.exit(0);
  } catch (err) {
    console.error("ERROR:", err.message);
    process.exit(1);
  }
}
main();
