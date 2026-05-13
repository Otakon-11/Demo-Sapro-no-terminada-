const { query } = require('./server/db');

async function createTables() {
  try {
    console.log("Creando tablas de Suscripción...");

    await query(`
      CREATE TABLE IF NOT EXISTS Estatus_Suscripcion (
        Ess_ID_Estatus_Suscripcion SERIAL PRIMARY KEY,
        Ess_Nombre VARCHAR(50) NOT NULL
      );
    `);

    // Insertar estatus por defecto si no existen
    await query(`
      INSERT INTO Estatus_Suscripcion (Ess_ID_Estatus_Suscripcion, Ess_Nombre)
      VALUES (1, 'Activa'), (2, 'Vencida')
      ON CONFLICT DO NOTHING;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS Tipo_Suscripcion (
        Tsu_ID_Tipo_Suscripcion SERIAL PRIMARY KEY,
        Tsu_Nombre VARCHAR(100) NOT NULL,
        Tsu_Duracion_Dias INT NOT NULL,
        Tsu_Precio NUMERIC(10,2) NOT NULL
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS Suscripcion (
        Sus_ID_Suscripcion SERIAL PRIMARY KEY,
        Cli_ID_Cliente INT REFERENCES Clientes(Cli_ID_Cliente) ON DELETE CASCADE,
        Tsu_ID_Tipo_Suscripcion INT REFERENCES Tipo_Suscripcion(Tsu_ID_Tipo_Suscripcion),
        Ess_ID_Estatus_Suscripcion INT REFERENCES Estatus_Suscripcion(Ess_ID_Estatus_Suscripcion),
        Sus_Monto_Pagado NUMERIC(10,2) NOT NULL,
        Sus_Fecha_Suscripcion DATE NOT NULL
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS Correo_Suscripcion (
        Csu_ID_Correo SERIAL PRIMARY KEY,
        Sus_ID_Suscripcion INT REFERENCES Suscripcion(Sus_ID_Suscripcion) ON DELETE CASCADE,
        Csu_Correo VARCHAR(150) NOT NULL,
        Csu_Nombre_Contacto VARCHAR(100),
        Csu_Es_Principal BOOLEAN DEFAULT FALSE,
        Csu_Fecha_Registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (Sus_ID_Suscripcion, Csu_Correo)
      );
    `);

    console.log("Tablas de suscripción creadas correctamente.");
  } catch (error) {
    console.error("Error creando tablas:", error);
  }
  process.exit(0);
}

createTables();
