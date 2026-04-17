const { query } = require('./db.js');

async function run() {
  try {
    const id = 1;
    const nombre = 'Test';
    const descripcion = 'Desc';
    const fechaInicioVal = new Date().toISOString().slice(0, 10);
    const fechaFin = null;
    const costo = 1000;
    const estadoId = 2;
    await query(
      `UPDATE Proyecto SET Pro_Nombre = $1, Pro_Descripcion = $2, Pro_Fecha_Inicio = $3, Pro_Fecha_Finalizacion = $4, Pro_Costo_Proyecto = $5, Epr_ID_Estatus_Proyecto = $6
       WHERE Pro_ID_Proyecto = $7`,
      [nombre, descripcion, fechaInicioVal, fechaFin, costo, estadoId, id]
    );
    console.log('Update success');
  } catch (err) {
    console.error('Update failed:', err.message);
  }
  process.exit();
}
run();
