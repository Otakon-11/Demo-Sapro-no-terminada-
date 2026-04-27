const { query } = require('./db');

async function main() {
  try {
    const proyectos = await query(`
        SELECT e.Epr_Nombre_Estatus as name, COUNT(p.Pro_ID_Proyecto)::int as value
        FROM Estado_Proyecto e
        LEFT JOIN Proyecto p ON e.Epr_ID_Estatus_Proyecto = p.Epr_ID_Estatus_Proyecto
        GROUP BY e.Epr_Nombre_Estatus
      `);
    console.log("Proyectos:", proyectos);
    
    const ingresos = await query(`
        SELECT TO_CHAR(Ing_Fecha_Ingreso, 'TMMon') as month, SUM(Ing_Monto)::numeric as ventas
        FROM Ingresos
        GROUP BY TO_CHAR(Ing_Fecha_Ingreso, 'TMMon'), EXTRACT(MONTH FROM Ing_Fecha_Ingreso)
        ORDER BY EXTRACT(MONTH FROM Ing_Fecha_Ingreso)
      `);
    console.log("Ingresos:", ingresos);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
main();
