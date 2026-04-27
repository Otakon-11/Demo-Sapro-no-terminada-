const { query } = require('./server/db');

async function testDashboard() {
  try {
    const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const results = await Promise.all([
      // 0
      query(`SELECT e.Epr_Nombre_Estatus AS name, COUNT(p.Pro_ID_Proyecto)::int AS value
             FROM Estado_Proyecto e
             LEFT JOIN Proyecto p ON e.Epr_ID_Estatus_Proyecto = p.Epr_ID_Estatus_Proyecto
             GROUP BY e.Epr_Nombre_Estatus`),
      // 1
      query(`SELECT e.Egs_Nombre AS name, COALESCE(SUM(g.Gas_Monto), 0)::numeric AS value
             FROM Estatus_Gasto e
             LEFT JOIN Gasto g ON g.Egs_ID_Estatus_Gasto = e.Egs_ID_Estatus_Gasto
             LEFT JOIN Concepto_Gasto c ON g.Cgs_ID_Concepto_Gasto = c.Cgs_ID_Concepto_Gasto AND c.Cgs_Nombre = 'Comisiones'
             GROUP BY e.Egs_Nombre`),
      // 2
      query(`SELECT TO_CHAR(Pro_Fecha_Inicio, 'TMMon') AS month, COUNT(*)::int AS iniciados,
                    EXTRACT(MONTH FROM Pro_Fecha_Inicio)::int AS m_order
             FROM Proyecto WHERE Pro_Fecha_Inicio IS NOT NULL
             GROUP BY month, m_order`),
      // 3
      query(`SELECT TO_CHAR(Pro_Fecha_Finalizacion, 'TMMon') AS month, COUNT(*)::int AS terminados,
                    EXTRACT(MONTH FROM Pro_Fecha_Finalizacion)::int AS m_order
             FROM Proyecto WHERE Pro_Fecha_Finalizacion IS NOT NULL
             GROUP BY month, m_order`),
      // 4
      query(`SELECT t.Tpc_Nombre AS name, COUNT(c.Cli_ID_Cliente)::int AS value
             FROM Tipo_Cliente t
             LEFT JOIN Clientes c ON t.Tpc_ID_Tipo_Cliente = c.Tpc_ID_Tipo_Cliente
             GROUP BY t.Tpc_Nombre`),
      // 5
      query(`SELECT COALESCE(SUM(Ing_Monto), 0)::numeric AS total FROM Ingresos
             WHERE EXTRACT(MONTH FROM Ing_Fecha_Ingreso) = EXTRACT(MONTH FROM CURRENT_DATE)
               AND EXTRACT(YEAR  FROM Ing_Fecha_Ingreso) = EXTRACT(YEAR  FROM CURRENT_DATE)`),
      // 6
      query(`SELECT COALESCE(SUM(Gas_Monto), 0)::numeric AS total FROM Gasto
             WHERE EXTRACT(MONTH FROM Gas_Fecha_Gasto) = EXTRACT(MONTH FROM CURRENT_DATE)
               AND EXTRACT(YEAR  FROM Gas_Fecha_Gasto) = EXTRACT(YEAR  FROM CURRENT_DATE)`),
      // 7
      query(`SELECT COALESCE(SUM(Ing_Monto), 0)::numeric AS total FROM Ingresos
             WHERE EXTRACT(YEAR FROM Ing_Fecha_Ingreso) = EXTRACT(YEAR FROM CURRENT_DATE)`),
      // 8
      query(`SELECT COALESCE(SUM(Gas_Monto), 0)::numeric AS total FROM Gasto
             WHERE EXTRACT(YEAR FROM Gas_Fecha_Gasto) = EXTRACT(YEAR FROM CURRENT_DATE)`),
      // 9
      query(`SELECT COUNT(*)::int AS total FROM Suscripcion WHERE Ess_ID_Estatus_Suscripcion = 1`),
      // 10
      query(`SELECT COUNT(*)::int AS total FROM Clientes WHERE Cli_Estatus = true`),
      // 11
      query(`SELECT COUNT(p.Pro_ID_Proyecto)::int AS total FROM Proyecto p
             JOIN Estado_Proyecto e ON e.Epr_ID_Estatus_Proyecto = p.Epr_ID_Estatus_Proyecto
             WHERE LOWER(e.Epr_Nombre_Estatus) NOT IN ('terminado','terminados','cancelado','cancelados')`),
      // 12
      query(`SELECT EXTRACT(MONTH FROM Ing_Fecha_Ingreso)::int AS mes,
                    COALESCE(SUM(Ing_Monto), 0)::numeric AS ingresos
             FROM Ingresos
             WHERE EXTRACT(YEAR FROM Ing_Fecha_Ingreso) = EXTRACT(YEAR FROM CURRENT_DATE)
             GROUP BY mes ORDER BY mes`),
      // 13
      query(`SELECT EXTRACT(MONTH FROM Gas_Fecha_Gasto)::int AS mes,
                    COALESCE(SUM(Gas_Monto), 0)::numeric AS gastos
             FROM Gasto
             WHERE EXTRACT(YEAR FROM Gas_Fecha_Gasto) = EXTRACT(YEAR FROM CURRENT_DATE)
             GROUP BY mes ORDER BY mes`),
      // 14
      query(`SELECT c.Cgs_Nombre AS name, COALESCE(SUM(g.Gas_Monto), 0)::numeric AS value
             FROM Concepto_Gasto c
             LEFT JOIN Gasto g ON g.Cgs_ID_Concepto_Gasto = c.Cgs_ID_Concepto_Gasto
             GROUP BY c.Cgs_Nombre ORDER BY value DESC LIMIT 6`),
      // 15
      query(`SELECT e.Ess_Nombre AS name, COUNT(s.Sus_ID_Suscripcion)::int AS value
             FROM Estatus_Suscripcion e
             LEFT JOIN Suscripcion s ON s.Ess_ID_Estatus_Suscripcion = e.Ess_ID_Estatus_Suscripcion
             GROUP BY e.Ess_Nombre`)
    ]);
    console.log("All queries passed!");
  } catch (err) {
    console.error("Query failed!");
    console.error(err);
  }
  process.exit(0);
}

testDashboard();
