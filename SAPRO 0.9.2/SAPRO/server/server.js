// ============================================================
// SERVIDOR: SAPRO API
// Framework : Express.js corriendo en puerto 4000
// Base de datos: PostgreSQL 18 (conexión vía db.js con node-postgres)
// Variables de entorno: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
//   cargadas desde el archivo .env en la raíz del servidor
//
// SECCIONES DE ESTE ARCHIVO:
//   1. Configuración inicial (cors, json, multer, tokens)
//   2. AUTH        → /api/login, /api/logout, /api/verify-token
//   3. PASSWORDS   → /api/passwords (CRUD de Login)
//   4. FILES/DOCS  → /api/upload, /api/files, /api/tipos-documento
//   5. PROJECTS    → /api/projects, /api/estados-proyecto
//   6. USUARIOS    → /api/usuarios + asignación a proyectos
//   7. CLIENTES    → /api/clientes, /api/tipos-cliente, /api/direcciones
//   8. GASTOS      → /api/gastos, /api/gastos/catalogos
//   9. COMISIONES  → /api/commissions
//  10. INGRESOS    → /api/ingresos, /api/ingresos/catalogos
//  11. SUSCRIPCIONES → /api/subscriptions (CRUD + renovar + correos)
//  12. CATÁLOGOS   → /api/catalogos (CRUD genérico multi-tabla)
//  13. REPORTES    → /api/reportes/:nombre (6 reportes)
//  14. DASHBOARD   → /api/dashboard/stats (16 queries en paralelo)
//  15. app.listen  → inicia en 0.0.0.0:4000
// ============================================================

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('./db.js'); // función query(sql, params) → Promise<rows[]>

const app  = express();
const PORT = 4000; // el frontend hace proxy de /api → localhost:4000

// ── Middleware global ─────────────────────────────────────────
app.use(cors());         // permite peticiones desde el cliente (localhost:5173)
app.use(express.json()); // parsea body JSON automáticamente

// ── Configuración de subida de archivos PDF (multer) ─────────
// Los PDFs se guardan en /server/uploads/ con nombre único (timestamp + nombre original)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename:    (req, file, cb) => {
    const uniqueName = Date.now() + '-' + (file.originalname || 'documento.pdf');
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Solo se aceptan PDFs
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF'), false);
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB máximo
});

// ── Autenticación con tokens en memoria ──────────────────────
// Los tokens son UUIDs generados en /api/login y almacenados en un Set en RAM.
// Al reiniciar el servidor, todos los tokens se invalidan (sesiones cerradas).
const validTokens = new Set();

// Middleware de autenticación: verifica que el Bearer token sea válido
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !validTokens.has(token)) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

// ============================================================
// SECCIÓN 2: AUTH
// Tablas: Usuario + Login
// El Login contiene la contraseña; Usuario contiene el perfil.
// El join se hace por Usu_ID_Usuario.
// ============================================================
app.get('/api/verify-token', authMiddleware, (req, res) => {
  // El frontend verifica el token en cada recarga de página
  res.json({ valid: true });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Usuario y contraseña requeridos' });
  }
  try {
    const rows = await query(
      `SELECT l.Log_ID, l.Log_Contraseña, u.Usu_ID_Usuario, u.Usu_Nombre, u.Usu_Apellido, u.Usu_Correo
       FROM Login l
       INNER JOIN Usuario u ON l.Usu_ID_Usuario = u.Usu_ID_Usuario
       WHERE u.Usu_Correo = $1 AND l.log_activo = true
       LIMIT 1`,
      [username.trim()]
    );
    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    }
    const row = rows[0];
    if (row.log_contraseña !== password) {
      return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    }
    const displayName = [row.usu_nombre, row.usu_apellido].filter(Boolean).join(' ') || row.usu_correo;
    const token = uuidv4(); // genera UUID como token de sesión
    validTokens.add(token); // lo registra en memoria
    return res.json({ success: true, token, user: displayName });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ success: false, error: 'Error al conectar con la base de datos' });
  }
});

app.post('/api/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) validTokens.delete(token);
  res.json({ success: true });
});

// ============================================================
// SECCIÓN 3: PASSWORDS (Contraseñas del Servidor)
// Muestra las credenciales de Login de todos los usuarios.
// No es un gestor de contraseñas genérico: lee directamente
// la tabla Login y mapea al formato { id, service, username, password }.
// POST devuelve 501 (solo se crean usuarios desde la BD directamente).
// DELETE desactiva el Login (Log_Activo = false) en vez de borrar.
// ============================================================
app.get('/api/passwords', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      `SELECT l.Log_ID, l.Log_Contraseña, u.Usu_Correo, u.Usu_Nombre, u.Usu_Apellido, u.Usu_Puesto_Principal
       FROM Login l
       INNER JOIN Usuario u ON l.Usu_ID_Usuario = u.Usu_ID_Usuario
       ORDER BY u.Usu_Nombre, u.Usu_Apellido`
    );
    const list = rows.map(r => ({
      id: String(r.log_id),
      service: 'SAPRO',
      username: r.usu_correo || '',
      password: r.log_contraseña || '',
      createdAt: new Date().toISOString()
    }));
    res.json(list);
  } catch (err) {
    console.error('Passwords list error:', err.message);
    res.status(500).json([]);
  }
});

app.put('/api/passwords/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'La contraseña es requerida' });
  try {
    const result = await query('UPDATE Login SET Log_Contraseña = $1 WHERE Log_ID = $2', [password, id]);
    if (!result || result.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' });
    const rows = await query(
      `SELECT l.Log_ID, l.Log_Contraseña, u.Usu_Correo
       FROM Login l INNER JOIN Usuario u ON l.Usu_ID_Usuario = u.Usu_ID_Usuario WHERE l.Log_ID = $1`,
      [id]
    );
    const r = rows && rows[0];
    res.json({
      id: String(r.log_id),
      service: 'SAPRO',
      username: r.usu_correo || '',
      password: r.log_contraseña || '',
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Password update error:', err.message);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

app.post('/api/passwords', authMiddleware, (req, res) => {
  res.status(501).json({ error: 'Agregar usuarios desde la base de datos (tablas Usuario y Login)' });
});

app.delete('/api/passwords/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query('UPDATE Login SET log_activo = false WHERE log_id = $1', [id]);
    if (!result || result.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ success: true });
  } catch (err) {
    console.error('Password delete error:', err.message);
    res.status(500).json({ error: 'Error al desactivar' });
  }
});

// ============================================================
// SECCIÓN 4: FILES / DOCUMENTOS
// Tabla: Documento (Doc_ID_Documento, Doc_Nombre, Doc_Archivo,
//        Doc_Descripcion, Pro_ID_Proyecto, Tdd_ID_Tipo_Documento)
// Los archivos PDF se guardan en /server/uploads/ con nombre único.
// La columna Doc_Archivo guarda el nombre del archivo en disco.
// Para ver un PDF: GET /api/files/:filename (requiere token).
// ============================================================
// Catálogo: tipos de documento
app.get('/api/tipos-documento', authMiddleware, async (req, res) => {
  try {
    const rows = await query('SELECT Tdd_ID_Tipo_Documento AS id, Tdd_Nombre_Tipo AS nombre FROM Tipo_Documento ORDER BY Tdd_ID_Tipo_Documento');
    res.json(rows);
  } catch (err) {
    console.error('Tipos documento error:', err.message);
    res.status(500).json([]);
  }
});

app.post('/api/upload', authMiddleware, upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
  const { projectId, tipoDocumentoId, nombre, descripcion = '' } = req.body;

  if (!projectId || !tipoDocumentoId) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Proyecto y tipo de documento son requeridos' });
  }

  try {
    const proyecto = await query('SELECT Pro_ID_Proyecto FROM Proyecto WHERE Pro_ID_Proyecto = $1', [projectId]);
    if (proyecto.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'El proyecto no existe' });
    }

    const tipo = await query('SELECT Tdd_ID_Tipo_Documento FROM Tipo_Documento WHERE Tdd_ID_Tipo_Documento = $1', [tipoDocumentoId]);
    if (tipo.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'El tipo de documento no existe' });
    }

    const docNombre = (nombre && nombre.trim()) ? nombre.trim() : (req.file.originalname || req.file.filename);
    await query(
      `INSERT INTO Documento (Doc_Nombre, Doc_Descripcion, Doc_Archivo, Pro_ID_Proyecto, Tdd_ID_Tipo_Documento)
       VALUES ($1, $2, $3, $4, $5)`,
      [docNombre, descripcion, req.file.filename, projectId, tipoDocumentoId]
    );
    res.json({
      success: true,
      file: {
        filename: req.file.filename,
        originalname: docNombre,
        size: req.file.size,
        uploadedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Upload/insert document error:', err.message);
    res.status(500).json({ error: 'Error al guardar el documento' });
  }
});

app.get('/api/files', authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.query;
    let sql = `SELECT d.Doc_ID_Documento, d.Doc_Nombre, d.Doc_Archivo, d.Doc_Descripcion,
                      d.Pro_ID_Proyecto, p.Pro_Nombre AS proyecto,
                      t.Tdd_Nombre_Tipo AS tipo_documento
               FROM Documento d
               LEFT JOIN Proyecto p ON d.Pro_ID_Proyecto = p.Pro_ID_Proyecto
               LEFT JOIN Tipo_Documento t ON d.Tdd_ID_Tipo_Documento = t.Tdd_ID_Tipo_Documento`;
    const params = [];
    if (projectId) {
      sql += ' WHERE d.Pro_ID_Proyecto = $1';
      params.push(projectId);
    }
    sql += ' ORDER BY d.Doc_ID_Documento DESC';
    const rows = await query(sql, params);
    const files = rows.map(r => {
      const filePath = path.join(uploadsDir, r.doc_archivo);
      let size = 0;
      if (fs.existsSync(filePath)) size = fs.statSync(filePath).size;
      return {
        filename: r.doc_archivo,
        originalname: r.doc_nombre || r.doc_archivo,
        descripcion: r.doc_descripcion || '',
        proyecto: r.proyecto || '',
        projectId: r.pro_id_proyecto,
        tipoDocumento: r.tipo_documento || '',
        size,
        uploadedAt: new Date().toISOString(),
        id: r.doc_id_documento
      };
    });
    res.json(files);
  } catch (err) {
    console.error('Files list error:', err.message);
    res.json([]);
  }
});

app.get('/api/files/:filename', authMiddleware, (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado' });
  res.sendFile(filePath);
});

app.delete('/api/files/:filename', authMiddleware, async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);
  try {
    await query('DELETE FROM Documento WHERE Doc_Archivo = $1', [filename]);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    console.error('File delete error:', err.message);
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// ============================================================
// SECCIÓN 5: PROJECTS (Proyectos)
// Tablas: Proyecto + Estado_Proyecto + Direccion + Ciudad + Municipio + Estado + Pais
// El GET hace un join completo para armar la dirección completa del proyecto.
// PATCH /estatus: si el nuevo estado es ID=4 (Terminado), también guarda la fecha de hoy.
// ============================================================
app.get('/api/estados-proyecto', authMiddleware, async (req, res) => {
  try {
    const rows = await query('SELECT Epr_ID_Estatus_Proyecto AS id, Epr_Nombre_Estatus AS nombre FROM Estado_Proyecto ORDER BY Epr_ID_Estatus_Proyecto');
    res.json(rows);
  } catch (err) {
    console.error('Estados proyecto error:', err.message);
    res.status(500).json([]);
  }
});

app.get('/api/projects', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      `SELECT p.Pro_ID_Proyecto       AS "Pro_ID_Proyecto",
              p.Pro_Nombre            AS "Pro_Nombre",
              p.Pro_Descripcion       AS "Pro_Descripcion",
              p.Pro_Fecha_Inicio      AS "Pro_Fecha_Inicio",
              p.Pro_Fecha_Finalizacion AS "Pro_Fecha_Finalizacion",
              p.Pro_Costo_Proyecto    AS "Pro_Costo_Proyecto",
              p.Epr_ID_Estatus_Proyecto AS "Epr_ID_Estatus_Proyecto",
              e.Epr_Nombre_Estatus    AS estado,
              TRIM(CONCAT_WS(', ', NULLIF(TRIM(d.dir_calle || ' ' || COALESCE(d.dir_numero, '')), ''), NULLIF(TRIM(d.dir_colonia), ''), NULLIF(TRIM(c.cdi_nombre), ''), NULLIF(TRIM(m.mun_nombre), ''), NULLIF(TRIM(edo.edo_nombre), ''), NULLIF(TRIM(pa.pai_nombre), ''))) AS "direccionCompleta"
       FROM Proyecto p
       LEFT JOIN Estado_Proyecto e ON p.Epr_ID_Estatus_Proyecto = e.Epr_ID_Estatus_Proyecto
       LEFT JOIN Direccion d ON p.dir_id_direccion = d.dir_id_direccion
       LEFT JOIN Ciudad c ON d.cdi_id_ciudad = c.cdi_id_ciudad
       LEFT JOIN Municipio m ON c.mun_id_municipio = m.mun_id_municipio
       LEFT JOIN Estado edo ON m.edo_id_estado = edo.edo_id_estado
       LEFT JOIN Pais pa ON edo.pai_id_pais = pa.pai_id_pais
       ORDER BY p.Pro_Fecha_Inicio DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Projects list error:', err.message);
    res.status(500).json([]);
  }
});

app.post('/api/projects', authMiddleware, async (req, res) => {
  const { nombre, descripcion, fechaInicio, fechaFin, costo, estadoId } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre del proyecto es requerido' });
  }
  try {
    const fechaInicioVal = fechaInicio || new Date().toISOString().slice(0, 10);
    await query(
      `INSERT INTO Proyecto (Pro_Nombre, Pro_Descripcion, Pro_Fecha_Inicio, Pro_Fecha_Finalizacion, Pro_Costo_Proyecto, Epr_ID_Estatus_Proyecto)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [nombre.trim(), descripcion || null, fechaInicioVal, fechaFin || null, costo ? Number(costo) : null, estadoId ? Number(estadoId) : 1]
    );
    const rows = await query(
      `SELECT p.Pro_ID_Proyecto        AS "Pro_ID_Proyecto",
              p.Pro_Nombre             AS "Pro_Nombre",
              p.Pro_Descripcion        AS "Pro_Descripcion",
              p.Pro_Fecha_Inicio       AS "Pro_Fecha_Inicio",
              p.Pro_Fecha_Finalizacion AS "Pro_Fecha_Finalizacion",
              p.Pro_Costo_Proyecto     AS "Pro_Costo_Proyecto",
              p.Epr_ID_Estatus_Proyecto AS "Epr_ID_Estatus_Proyecto",
              e.Epr_Nombre_Estatus     AS estado
       FROM Proyecto p
       LEFT JOIN Estado_Proyecto e ON p.Epr_ID_Estatus_Proyecto = e.Epr_ID_Estatus_Proyecto
       ORDER BY p.Pro_ID_Proyecto DESC LIMIT 1`
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Project create error:', err.message);
    res.status(500).json({ error: 'Error al crear el proyecto' });
  }
});

app.put('/api/projects/:id', authMiddleware, async (req, res) => {
  const { nombre, descripcion, fechaInicio, fechaFin, costo, estadoId } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const exists = await query('SELECT Pro_ID_Proyecto FROM Proyecto WHERE Pro_ID_Proyecto=$1', [req.params.id]);
    if (!exists.length) return res.status(404).json({ error: 'Proyecto no encontrado' });
    await query(
      `UPDATE Proyecto SET Pro_Nombre=$1, Pro_Descripcion=$2, Pro_Fecha_Inicio=$3,
       Pro_Fecha_Finalizacion=$4, Pro_Costo_Proyecto=$5, Epr_ID_Estatus_Proyecto=$6
       WHERE Pro_ID_Proyecto=$7`,
      [nombre.trim(), descripcion || null, fechaInicio || null,
       fechaFin || null, costo ? Number(costo) : null, estadoId ? Number(estadoId) : 1, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Project update error:', err.message);
    res.status(500).json({ error: 'Error al actualizar el proyecto' });
  }
});

app.patch('/api/projects/:id/estatus', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { estadoId } = req.body;
  if (!estadoId) {
    return res.status(400).json({ error: 'El estadoId es requerido' });
  }
  try {
    const estadoCheck = await query('SELECT 1 FROM Estado_Proyecto WHERE Epr_ID_Estatus_Proyecto = $1', [Number(estadoId)]);
    if (estadoCheck.length === 0) {
      return res.status(400).json({ error: 'El estatus especificado no existe' });
    }

    let updateSql = 'UPDATE Proyecto SET Epr_ID_Estatus_Proyecto = $1';
    const params = [Number(estadoId), id];

    if (Number(estadoId) === 4) { // 4 is Terminado
      updateSql += ', Pro_Fecha_Finalizacion = CURRENT_DATE';
    }
    
    updateSql += ' WHERE Pro_ID_Proyecto = $2 RETURNING *';
    
    const rows = await query(updateSql, params);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Error: Proyecto no existe' });
    }
    res.json({ success: true, project: rows[0] });
  } catch (err) {
    console.error('Project status update error:', err.message);
    res.status(500).json({ error: 'Error al actualizar estatus' });
  }
});

// ============================================================
// SECCIÓN 6: USUARIOS Y ASIGNACIÓN A PROYECTOS
// Tablas: Usuario + Login (para /api/usuarios)
//         Proyecto_Usuario (para asignación miembros del proyecto)
// Al crear un usuario se insertan dos filas: una en Usuario y una en Login.
// La contraseña se guarda en texto plano en Login (Log_Contraseña).
// PUT /api/usuarios/:id: si se envía contrasena vacío, NO se actualiza la contraseña.
// ============================================================
app.get('/api/usuarios', authMiddleware, async (req, res) => {
  try {
    const rows = await query(`
      SELECT u.Usu_ID_Usuario    AS id,
             u.Usu_Nombre        AS nombre,
             u.Usu_Apellido      AS apellido,
             u.Usu_Puesto_Principal AS puesto,
             u.Usu_Telefono      AS telefono,
             u.Usu_Correo        AS correo,
             l.Log_Activo        AS activo
      FROM Usuario u
      LEFT JOIN Login l ON u.Usu_ID_Usuario = l.Usu_ID_Usuario
      ORDER BY u.Usu_Nombre`);
    res.json(rows);
  } catch (err) {
    console.error('Usuarios error:', err.message);
    res.status(500).json([]);
  }
});

app.post('/api/usuarios', authMiddleware, async (req, res) => {
  const { nombre, apellido, puesto, telefono, correo, contrasena } = req.body;
  if (!nombre || !apellido || !puesto || !telefono || !correo || !contrasena) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }
  try {
    const existing = await query('SELECT Usu_ID_Usuario FROM Usuario WHERE Usu_Correo = $1', [correo]);
    if (existing.length) return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    const result = await query(
      `INSERT INTO Usuario (Usu_Nombre, Usu_Apellido, Usu_Puesto_Principal, Usu_Telefono, Usu_Correo)
       VALUES ($1,$2,$3,$4,$5) RETURNING Usu_ID_Usuario AS id`,
      [nombre, apellido, puesto, telefono, correo]
    );
    const userId = result[0].id;
    await query(
      `INSERT INTO Login (Log_Contraseña, Usu_ID_Usuario, Log_Activo) VALUES ($1,$2,TRUE)`,
      [contrasena, userId]
    );
    res.status(201).json({ id: userId });
  } catch (err) {
    console.error('Usuario create error:', err.message);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

app.put('/api/usuarios/:id', authMiddleware, async (req, res) => {
  const { nombre, apellido, puesto, telefono, correo, contrasena, activo } = req.body;
  if (!nombre || !apellido || !puesto || !telefono || !correo) {
    return res.status(400).json({ error: 'Nombre, apellido, puesto, teléfono y correo son requeridos' });
  }
  try {
    const exists = await query('SELECT Usu_ID_Usuario FROM Usuario WHERE Usu_ID_Usuario = $1', [req.params.id]);
    if (!exists.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    const dup = await query('SELECT Usu_ID_Usuario FROM Usuario WHERE Usu_Correo=$1 AND Usu_ID_Usuario<>$2', [correo, req.params.id]);
    if (dup.length) return res.status(409).json({ error: 'Ese correo ya está en uso por otro usuario' });
    await query(
      `UPDATE Usuario SET Usu_Nombre=$1, Usu_Apellido=$2, Usu_Puesto_Principal=$3, Usu_Telefono=$4, Usu_Correo=$5
       WHERE Usu_ID_Usuario=$6`,
      [nombre, apellido, puesto, telefono, correo, req.params.id]
    );
    if (contrasena) {
      await query('UPDATE Login SET Log_Contraseña=$1 WHERE Usu_ID_Usuario=$2', [contrasena, req.params.id]);
    }
    if (activo !== undefined) {
      await query('UPDATE Login SET Log_Activo=$1 WHERE Usu_ID_Usuario=$2', [activo, req.params.id]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Usuario update error:', err.message);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

app.delete('/api/usuarios/:id', authMiddleware, async (req, res) => {
  try {
    const exists = await query('SELECT Usu_ID_Usuario FROM Usuario WHERE Usu_ID_Usuario=$1', [req.params.id]);
    if (!exists.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    await query('DELETE FROM Login WHERE Usu_ID_Usuario=$1', [req.params.id]);
    await query('DELETE FROM Usuario WHERE Usu_ID_Usuario=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Usuario delete error:', err.message);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

app.get('/api/projects/:id/usuarios', authMiddleware, async (req, res) => {
  try {
    const rows = await query(`
      SELECT pu.usu_id_usuario AS id, u.Usu_Nombre AS nombre, u.Usu_Apellido AS apellido, u.Usu_Correo AS correo, pu.ppr_id_puesto_proyecto AS "puestoId"
      FROM Proyecto_Usuario pu
      INNER JOIN Usuario u ON pu.usu_id_usuario = u.Usu_ID_Usuario
      WHERE pu.pro_id_proyecto = $1
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    console.error('Project users error:', err.message);
    res.status(500).json([]);
  }
});

app.post('/api/projects/:id/usuarios', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { usuId, puestoId } = req.body;
  if (!usuId) return res.status(400).json({ error: 'Usuario es requerido' });
  try {
    await query(
      'INSERT INTO Proyecto_Usuario (pro_id_proyecto, usu_id_usuario, ppr_id_puesto_proyecto) VALUES ($1, $2, $3)',
      [id, usuId, puestoId || 1]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Project add user error:', err.message);
    res.status(500).json({ error: 'Error al asignar usuario (puede que ya esté asignado)' });
  }
});

app.delete('/api/projects/:id/usuarios/:usuId', authMiddleware, async (req, res) => {
  try {
    await query('DELETE FROM Proyecto_Usuario WHERE pro_id_proyecto = $1 AND usu_id_usuario = $2', [req.params.id, req.params.usuId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Project remove user error:', err.message);
    res.status(500).json({ error: 'Error al remover usuario' });
  }
});

// ============================================================
// SECCIÓN 7: CLIENTES
// Tablas: Cliente + Tipo_Cliente (catálogo) + Direccion (catálogo)
// GET /api/clientes?search=... → busca por nombre, RFC o correo
// PATCH /api/clientes/:id/estatus → alterna Cli_Estatus (boolean)
// GET /api/direcciones → catálogo de direcciones (CONCAT_WS para descripción legible)
// GET /api/tipos-cliente → catálogo de categorías de cliente
// ============================================================
app.get('/api/direcciones', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      `SELECT d.dir_id_direccion AS id,
              TRIM(CONCAT_WS(', ',
                NULLIF(TRIM(d.dir_calle || ' ' || COALESCE(d.dir_numero,'')), ''),
                NULLIF(TRIM(d.dir_colonia),''),
                NULLIF(TRIM(c.cdi_nombre),''),
                NULLIF(TRIM(m.mun_nombre),''),
                NULLIF(TRIM(e.edo_nombre),'')
              )) AS descripcion
       FROM direccion d
       LEFT JOIN ciudad c ON d.cdi_id_ciudad = c.cdi_id_ciudad
       LEFT JOIN municipio m ON c.mun_id_municipio = m.mun_id_municipio
       LEFT JOIN estado e ON m.edo_id_estado = e.edo_id_estado
       ORDER BY d.dir_id_direccion`
    );
    res.json(rows);
  } catch (err) {
    console.error('Direcciones error:', err.message);
    res.json([]);
  }
});

app.get('/api/tipos-cliente', authMiddleware, async (req, res) => {
  try {
    const rows = await query('SELECT Tpc_ID_Tipo_Cliente AS id, Tpc_Nombre AS nombre FROM Tipo_Cliente ORDER BY Tpc_ID_Tipo_Cliente');
    res.json(rows);
  } catch (err) {
    console.error('Tipos cliente error:', err.message);
    res.json([]);
  }
});

app.get('/api/clientes', authMiddleware, async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `SELECT c.Cli_ID_Cliente    AS id,
                      c.Cli_Nombre        AS nombre,
                      c.Cli_Tipo          AS tipo,
                      c.Cli_RFC           AS rfc,
                      c.Cli_Telefono      AS telefono,
                      c.Cli_Correo        AS correo,
                      c.Cli_Contacto_Nombre AS contactoNombre,
                      c.Cli_Contacto_Puesto AS contactoPuesto,
                      c.Cli_Fecha_Registro  AS fechaRegistro,
                      c.Cli_Estatus         AS estatus,
                      t.Tpc_Nombre          AS tipoCliente,
                      c.Tpc_ID_Tipo_Cliente AS tipoClienteId,
                      c.Dir_ID_Direccion    AS direccionId,
                      TRIM(CONCAT_WS(', ',
                        NULLIF(TRIM(d.dir_calle || ' ' || COALESCE(d.dir_numero,'')), ''),
                        NULLIF(TRIM(d.dir_colonia),''),
                        NULLIF(TRIM(ci.cdi_nombre),''),
                        NULLIF(TRIM(m.mun_nombre),''),
                        NULLIF(TRIM(e.edo_nombre),'')
                      )) AS direccion
               FROM Clientes c
               LEFT JOIN Tipo_Cliente t ON c.Tpc_ID_Tipo_Cliente = t.Tpc_ID_Tipo_Cliente
               LEFT JOIN direccion d ON c.Dir_ID_Direccion = d.dir_id_direccion
               LEFT JOIN ciudad ci ON d.cdi_id_ciudad = ci.cdi_id_ciudad
               LEFT JOIN municipio m ON ci.mun_id_municipio = m.mun_id_municipio
               LEFT JOIN estado e ON m.edo_id_estado = e.edo_id_estado`;
    const params = [];
    if (search && search.trim()) {
      sql += ` WHERE c.Cli_Nombre ILIKE $1 OR c.Cli_RFC ILIKE $1 OR c.Cli_Correo ILIKE $1`;
      params.push(`%${search.trim()}%`);
    }
    sql += ' ORDER BY c.Cli_Nombre ASC';
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Clientes list error:', err.message);
    res.json([]);
  }
});

app.post('/api/clientes', authMiddleware, async (req, res) => {
  const { nombre, tipo, rfc, telefono, correo, contactoNombre, contactoPuesto, tipoClienteId, direccionId } = req.body;
  if (!nombre || !tipo || !telefono || !correo) {
    return res.status(400).json({ error: 'Nombre, tipo, teléfono y correo son requeridos' });
  }
  try {
    const result = await query(
      `INSERT INTO Clientes (Cli_Nombre, Cli_Tipo, Cli_RFC, Cli_Telefono, Cli_Correo, Cli_Contacto_Nombre, Cli_Contacto_Puesto, Tpc_ID_Tipo_Cliente, Dir_ID_Direccion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING Cli_ID_Cliente AS id`,
      [nombre.trim(), tipo.trim(), rfc || null, telefono.trim(), correo.trim(),
       contactoNombre || null, contactoPuesto || null, tipoClienteId || null, direccionId || null]
    );
    res.status(201).json({ id: result[0].id, nombre, tipo, rfc, telefono, correo, contactoNombre, contactoPuesto, tipoClienteId, estatus: true });
  } catch (err) {
    console.error('Cliente create error:', err.message);
    res.status(500).json({ error: 'Error al crear el cliente' });
  }
});

app.put('/api/clientes/:id', authMiddleware, async (req, res) => {
  const { nombre, tipo, rfc, telefono, correo, contactoNombre, contactoPuesto, tipoClienteId, direccionId } = req.body;
  if (!nombre || !tipo || !telefono || !correo) {
    return res.status(400).json({ error: 'Nombre, tipo, teléfono y correo son requeridos' });
  }
  try {
    await query(
      `UPDATE Clientes SET Cli_Nombre=$1, Cli_Tipo=$2, Cli_RFC=$3, Cli_Telefono=$4, Cli_Correo=$5,
       Cli_Contacto_Nombre=$6, Cli_Contacto_Puesto=$7, Tpc_ID_Tipo_Cliente=$8, Dir_ID_Direccion=$9
       WHERE Cli_ID_Cliente=$10`,
      [nombre.trim(), tipo.trim(), rfc || null, telefono.trim(), correo.trim(),
       contactoNombre || null, contactoPuesto || null, tipoClienteId || null, direccionId || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Cliente update error:', err.message);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

app.patch('/api/clientes/:id/estatus', authMiddleware, async (req, res) => {
  try {
    const rows = await query('SELECT Cli_Estatus FROM Clientes WHERE Cli_ID_Cliente=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Cliente no encontrado' });
    const nuevoEstatus = !rows[0].cli_estatus;
    await query('UPDATE Clientes SET Cli_Estatus=$1 WHERE Cli_ID_Cliente=$2', [nuevoEstatus, req.params.id]);
    res.json({ estatus: nuevoEstatus });
  } catch (err) {
    console.error('Cliente estatus error:', err.message);
    res.status(500).json({ error: 'Error al cambiar estatus' });
  }
});

// ============================================================
// SECCIÓN 8: GASTOS
// Tabla principal: Gasto (Gas_ID_Gasto, Gas_Descripcion, Gas_Monto, Gas_Fecha, etc.)
// GET /api/gastos/catalogos → en un solo request trae todos los catálogos necesarios:
//   Concepto_Gasto, Forma_Pago_Gasto, Estatus_Gasto, Proveedor, archivos (comprobantes)
// GET /api/gastos → soporta filtros: fechaInicio, fechaFin, concepto, estatus, proveedor
// POST /api/gastos → crea gasto
// PATCH /api/gastos/:id/estatus → cambia solo el estatus (Gas_ID_Estatus_Gasto)
// ============================================================
app.get('/api/gastos/catalogos', authMiddleware, async (req, res) => {
  try {
    const [conceptos, formas, estatus, proveedores, comprobantes] = await Promise.all([
      query('SELECT Cgs_ID_Concepto_Gasto AS id, Cgs_Nombre AS nombre FROM Concepto_Gasto ORDER BY id'),
      query('SELECT Fgs_ID_Forma_Gasto AS id, Fgs_Nombre AS nombre FROM Forma_Gasto ORDER BY id'),
      query('SELECT Egs_ID_Estatus_Gasto AS id, Egs_Nombre AS nombre FROM Estatus_Gasto ORDER BY id'),
      query('SELECT Prv_ID_Proveedor AS id, Prv_Nombre_Proveedor AS nombre FROM Proveedor ORDER BY nombre'),
      query('SELECT Com_ID_Comprobante AS id, Com_Nombre AS nombre FROM Comprobante ORDER BY nombre')
    ]);
    res.json({ conceptos, formas, estatus, proveedores, comprobantes });
  } catch (err) {
    console.error('Gastos catalogos error:', err.message);
    res.status(500).json({ error: 'Error al cargar catálogos' });
  }
});

app.get('/api/gastos', authMiddleware, async (req, res) => {
  try {
    const { projectId, conceptoId, estatusId, proveedorId, from, to } = req.query;
    const params = [];
    const where = [];
    if (projectId)   { params.push(projectId);   where.push(`g.Pro_ID_Proyecto = $${params.length}`); }
    if (conceptoId)  { params.push(conceptoId);  where.push(`g.Cgs_ID_Concepto_Gasto = $${params.length}`); }
    if (estatusId)   { params.push(estatusId);   where.push(`g.Egs_ID_Estatus_Gasto = $${params.length}`); }
    if (proveedorId) { params.push(proveedorId); where.push(`g.Prv_ID_Proveedor = $${params.length}`); }
    if (from)        { params.push(from);        where.push(`g.Gas_Fecha_Gasto >= $${params.length}`); }
    if (to)          { params.push(to);          where.push(`g.Gas_Fecha_Gasto <= $${params.length}`); }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const rows = await query(
      `SELECT g.Gas_ID_Gasto                         AS id,
              g.Gas_Monto                            AS monto,
              g.Gas_Fecha_Gasto                      AS fecha,
              g.Gas_Comprobante_Gasto                AS "comprobanteId",
              com.Com_Nombre                         AS comprobante,
              g.Gas_Es_Proveedor                     AS "esProveedor",
              c.Cgs_Nombre                           AS concepto,
              g.Cgs_ID_Concepto_Gasto                AS "conceptoId",
              f.Fgs_Nombre                           AS "formaPago",
              g.Fgs_ID_Forma_Gasto                   AS "formaPagoId",
              p.Pro_Nombre                           AS proyecto,
              g.Pro_ID_Proyecto                      AS "proyectoId",
              e.Egs_Nombre                           AS estatus,
              g.Egs_ID_Estatus_Gasto                 AS "estatusId",
              u.Usu_Nombre || ' ' || u.Usu_Apellido  AS usuario,
              g.Usu_ID_Usuario                       AS "usuarioId",
              prv.Prv_Nombre_Proveedor               AS proveedor,
              g.Prv_ID_Proveedor                     AS "proveedorId"
       FROM Gasto g
       INNER JOIN Concepto_Gasto c  ON g.Cgs_ID_Concepto_Gasto = c.Cgs_ID_Concepto_Gasto
       INNER JOIN Forma_Gasto f     ON g.Fgs_ID_Forma_Gasto    = f.Fgs_ID_Forma_Gasto
       INNER JOIN Estatus_Gasto e   ON g.Egs_ID_Estatus_Gasto  = e.Egs_ID_Estatus_Gasto
       INNER JOIN Proyecto p        ON g.Pro_ID_Proyecto        = p.Pro_ID_Proyecto
       INNER JOIN Usuario u         ON g.Usu_ID_Usuario         = u.Usu_ID_Usuario
       LEFT JOIN Proveedor prv      ON g.Prv_ID_Proveedor       = prv.Prv_ID_Proveedor
       LEFT JOIN Comprobante com    ON g.Gas_Comprobante_Gasto  = com.Com_ID_Comprobante::TEXT
       ${whereClause}
       ORDER BY g.Gas_Fecha_Gasto DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('Gastos list error:', err.message);
    res.status(500).json([]);
  }
});

app.post('/api/gastos', authMiddleware, async (req, res) => {
  const { conceptoId, monto, fecha, formaPagoId, comprobanteId, esProveedor, proveedorId, usuarioId, proyectoId, estatusId } = req.body;
  if (!conceptoId || !monto || !fecha || !formaPagoId || !usuarioId || !proyectoId || !estatusId) {
    return res.status(400).json({ error: 'Concepto, monto, fecha, forma de pago, usuario, proyecto y estatus son requeridos' });
  }
  if (Number(monto) <= 0) {
    return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
  }
  if (new Date(fecha) > new Date()) {
    return res.status(400).json({ error: 'La fecha no puede ser futura' });
  }
  try {
    const result = await query(
      `INSERT INTO Gasto (Cgs_ID_Concepto_Gasto, Gas_Monto, Gas_Fecha_Gasto, Fgs_ID_Forma_Gasto,
        Gas_Comprobante_Gasto, Gas_Es_Proveedor, Prv_ID_Proveedor, Usu_ID_Usuario, Pro_ID_Proyecto, Egs_ID_Estatus_Gasto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING Gas_ID_Gasto AS id`,
      [conceptoId, monto, fecha, formaPagoId, comprobanteId ? String(comprobanteId) : null,
       esProveedor || false, esProveedor ? proveedorId || null : null,
       usuarioId, proyectoId, estatusId]
    );
    res.status(201).json({ id: result[0].id });
  } catch (err) {
    console.error('Gasto create error:', err.message);
    res.status(500).json({ error: 'Error al registrar el gasto' });
  }
});

app.patch('/api/gastos/:id/estatus', authMiddleware, async (req, res) => {
  const { estatusId } = req.body;
  if (!estatusId) return res.status(400).json({ error: 'Estatus requerido' });
  try {
    const rows = await query('SELECT Gas_ID_Gasto FROM Gasto WHERE Gas_ID_Gasto=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Gasto no encontrado' });
    await query('UPDATE Gasto SET Egs_ID_Estatus_Gasto=$1 WHERE Gas_ID_Gasto=$2', [estatusId, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Gasto estatus error:', err.message);
    res.status(500).json({ error: 'Error al actualizar estatus' });
  }
});

// ============================================================
// SECCIÓN 9: COMISIONES
// No es una tabla propia. Filtra Gasto WHERE concepto = 'Comisiones'.
// Devuelve los gastos de tipo comisión con nombre del responsable y proyecto.
// Los estatus de Gasto se mapean a 'Pagada'/'Pendiente' en memoria.
// ============================================================
app.get('/api/commissions', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      `SELECT g.Gas_ID_Gasto, g.Gas_Monto, g.Gas_Fecha_Gasto, g.Egs_ID_Estatus_Gasto,
              u.Usu_Nombre, u.Usu_Apellido, pr.Pro_Nombre AS proyecto
       FROM Gasto g
       INNER JOIN Concepto_Gasto c ON g.Cgs_ID_Concepto_Gasto = c.Cgs_ID_Concepto_Gasto
       INNER JOIN Usuario u ON g.Usu_ID_Usuario = u.Usu_ID_Usuario
       INNER JOIN Proyecto pr ON g.Pro_ID_Proyecto = pr.Pro_ID_Proyecto
       WHERE c.Cgs_Nombre = 'Comisiones'
       ORDER BY g.Gas_Fecha_Gasto DESC`
    );
    const statusMap = {}; // Egs_ID_Estatus_Gasto -> Pagada | Pendiente
    try {
      const estatusRows = await query('SELECT Egs_ID_Estatus_Gasto, Egs_Nombre FROM Estatus_Gasto');
      estatusRows.forEach(r => {
        statusMap[r.egs_id_estatus_gasto] = r.egs_nombre === 'Pagado' ? 'Pagada' : (r.egs_nombre === 'Pendiente' ? 'Pendiente' : r.egs_nombre);
      });
    } catch (_) {}
    const list = rows.map(r => {
      const employee = [r.usu_nombre, r.usu_apellido].filter(Boolean).join(' ') || 'Sin nombre';
      const status = statusMap[r.egs_id_estatus_gasto] || 'Pendiente';
      return {
        id: String(r.gas_id_gasto),
        employee,
        project: r.proyecto || '',
        product: 'Comisión',
        amount: Number(r.gas_monto) || 0,
        commissionRate: 0,
        status: status === 'Pagado' || status === 'Pagada' ? 'Pagada' : 'Pendiente',
        paymentDate: status === 'Pagada' ? (r.gas_fecha_gasto ? String(r.gas_fecha_gasto).slice(0, 10) : null) : null
      };
    });
    res.json(list);
  } catch (err) {
    console.error('Commissions list error:', err.message);
    res.status(500).json([]);
  }
});

// ============================================================
// SECCIÓN 10: INGRESOS
// Tabla: Ingreso (Ing_ID_Ingreso, Ing_Monto, Ing_Fecha, etc.)
// GET /api/ingresos/catalogos → catálogos en un solo request:
//   Concepto_Ingreso, Forma_Pago_Ingreso, Estatus_Ingreso, Proyecto, Documento
// GET /api/ingresos → soporta filtros: fechaInicio, fechaFin, concepto, estatus
// POST /api/ingresos → crea ingreso
// PATCH /api/ingresos/:id/estatus → cambia el estatus del ingreso
// PATCH /api/ingresos/:id/comprobante → asigna o quita (null) el comprobante PDF
// ============================================================
app.get('/api/ingresos/catalogos', authMiddleware, async (req, res) => {
  try {
    const [conceptos, formas, estatus] = await Promise.all([
      query('SELECT Cin_ID_Concepto_Ingreso AS id, Cin_Nombre AS nombre FROM Concepto_Ingreso ORDER BY id'),
      query('SELECT Fin_ID_Forma_Ingreso AS id, Fin_Nombre AS nombre FROM Forma_Ingreso ORDER BY id'),
      query('SELECT Ein_ID_Estatus_Ingreso AS id, Ein_Nombre AS nombre FROM Estatus_Ingreso ORDER BY id')
    ]);
    res.json({ conceptos, formas, estatus });
  } catch (err) {
    console.error('Ingresos catalogos error:', err.message);
    res.status(500).json({ error: 'Error al cargar catálogos' });
  }
});

app.get('/api/ingresos', authMiddleware, async (req, res) => {
  try {
    const { projectId, estatusId, from, to } = req.query;
    const params = [];
    const where = [];
    if (projectId) { params.push(projectId); where.push(`i.Pro_ID_Proyecto = $${params.length}`); }
    if (estatusId) { params.push(estatusId); where.push(`i.Ein_ID_Estatus_Ingreso = $${params.length}`); }
    if (from)      { params.push(from);      where.push(`i.Ing_Fecha_Ingreso >= $${params.length}`); }
    if (to)        { params.push(to);        where.push(`i.Ing_Fecha_Ingreso <= $${params.length}`); }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const rows = await query(
      `SELECT i.Ing_ID_Ingreso          AS id,
              i.Ing_Monto               AS monto,
              i.Ing_Fecha_Ingreso       AS fecha,
              i.Ing_Comprobante_Pago    AS comprobante,
              c.Cin_Nombre              AS concepto,
              i.Cin_ID_Concepto_Ingreso AS "conceptoId",
              f.Fin_Nombre              AS "formaPago",
              i.Fin_ID_Forma_Ingreso    AS "formaPagoId",
              p.Pro_Nombre              AS proyecto,
              i.Pro_ID_Proyecto         AS "proyectoId",
              e.Ein_Nombre              AS estatus,
              i.Ein_ID_Estatus_Ingreso  AS "estatusId"
       FROM Ingresos i
       JOIN Concepto_Ingreso  c ON i.Cin_ID_Concepto_Ingreso   = c.Cin_ID_Concepto_Ingreso
       JOIN Forma_Ingreso     f ON i.Fin_ID_Forma_Ingreso       = f.Fin_ID_Forma_Ingreso
       JOIN Proyecto          p ON i.Pro_ID_Proyecto            = p.Pro_ID_Proyecto
       JOIN Estatus_Ingreso   e ON i.Ein_ID_Estatus_Ingreso     = e.Ein_ID_Estatus_Ingreso
       ${whereClause}
       ORDER BY i.Ing_Fecha_Ingreso DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('Ingresos list error:', err.message);
    res.json([]);
  }
});

app.post('/api/ingresos', authMiddleware, async (req, res) => {
  const { conceptoId, monto, fecha, formaPagoId, comprobante, proyectoId, estatusId } = req.body;
  if (!conceptoId || !monto || !fecha || !formaPagoId || !proyectoId) {
    return res.status(400).json({ error: 'Concepto, monto, fecha, forma de pago y proyecto son requeridos' });
  }
  try {
    const result = await query(
      `INSERT INTO Ingresos (Cin_ID_Concepto_Ingreso, Ing_Monto, Ing_Fecha_Ingreso, Fin_ID_Forma_Ingreso, Ing_Comprobante_Pago, Pro_ID_Proyecto, Ein_ID_Estatus_Ingreso)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING Ing_ID_Ingreso AS id`,
      [conceptoId, monto, fecha, formaPagoId, comprobante || null, proyectoId, estatusId || 1]
    );
    res.status(201).json({ id: result[0].id });
  } catch (err) {
    console.error('Ingreso create error:', err.message);
    res.status(500).json({ error: 'Error al registrar ingreso' });
  }
});

app.patch('/api/ingresos/:id/estatus', authMiddleware, async (req, res) => {
  const { estatusId } = req.body;
  if (!estatusId) return res.status(400).json({ error: 'estatusId requerido' });
  try {
    const result = await query(
      'UPDATE Ingresos SET Ein_ID_Estatus_Ingreso=$1 WHERE Ing_ID_Ingreso=$2 RETURNING Ing_ID_Ingreso',
      [estatusId, req.params.id]
    );
    if (!result.length) return res.status(404).json({ error: 'Ingreso no encontrado' });
    res.json({ success: true });
  } catch (err) {
    console.error('Ingreso estatus error:', err.message);
    res.status(500).json({ error: 'Error al actualizar estatus' });
  }
});

app.patch('/api/ingresos/:id/comprobante', authMiddleware, async (req, res) => {
  const { comprobante } = req.body;
  try {
    await query('UPDATE Ingresos SET Ing_Comprobante_Pago=$1 WHERE Ing_ID_Ingreso=$2', [comprobante || null, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Ingreso comprobante error:', err.message);
    res.status(500).json({ error: 'Error al actualizar comprobante' });
  }
});

// ============================================================
// SECCIÓN 11: SUSCRIPCIONES
// Tablas: Suscripcion + Tipo_Suscripcion + Estatus_Suscripcion + Correo_Suscripcion
// GET /api/subscriptions → lista con join de cliente, tipo y estatus
// POST /api/subscriptions → crear suscripción nueva
// PUT /api/subscriptions/:id → editar suscripción existente
// PUT /api/subscriptions/:id/renovar → renueva (pone Ess_ID=1=Activa)
// POST /api/subscriptions/verificar-vencimientos → marca vencidas las que ya expiró
//   (compara Sus_Fecha_Suscripcion + duración con CURRENT_DATE)
// CORREOS: GET/POST/PUT(principal)/DELETE → correos de contacto de la suscripción
// ============================================================

// Catálogo: tipos de suscripción
app.get('/api/subscriptions/tipos', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      `SELECT Tsu_ID_Tipo_Suscripcion AS id,
              Tsu_Nombre              AS nombre,
              Tsu_Duracion_Dias       AS duracion_dias,
              Tsu_Precio              AS precio
       FROM Tipo_Suscripcion
       ORDER BY Tsu_Precio ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Subscriptions tipos error:', err.message);
    res.status(500).json([]);
  }
});

// Catálogo: estatus de suscripción
app.get('/api/subscriptions/estatus', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      `SELECT Ess_ID_Estatus_Suscripcion AS id,
              Ess_Nombre                 AS nombre
       FROM Estatus_Suscripcion
       ORDER BY Ess_ID_Estatus_Suscripcion ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Subscriptions estatus error:', err.message);
    res.status(500).json([]);
  }
});

// Listar todas las suscripciones
app.get('/api/subscriptions', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      `SELECT s.Sus_ID_Suscripcion                   AS id,
              c.Cli_ID_Cliente                        AS "clienteId",
              c.Cli_Nombre                            AS cliente,
              t.Tsu_Nombre                            AS plan,
              t.Tsu_Duracion_Dias                     AS "duracionDias",
              t.Tsu_Precio                            AS "precioPlan",
              s.Sus_Fecha_Suscripcion                 AS "fechaSuscripcion",
              s.Sus_Monto_Pagado                      AS "montoPagado",
              e.Ess_Nombre                            AS estatus
       FROM Suscripcion          s
       JOIN Clientes              c ON s.Cli_ID_Cliente              = c.Cli_ID_Cliente
       JOIN Tipo_Suscripcion      t ON s.Tsu_ID_Tipo_Suscripcion     = t.Tsu_ID_Tipo_Suscripcion
       JOIN Estatus_Suscripcion   e ON s.Ess_ID_Estatus_Suscripcion  = e.Ess_ID_Estatus_Suscripcion
       ORDER BY s.Sus_Fecha_Suscripcion DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Subscriptions list error:', err.message);
    res.status(500).json([]);
  }
});

// Crear suscripción
app.post('/api/subscriptions', authMiddleware, async (req, res) => {
  const { clienteId, tipoId, montoPagado, fecha, estatusId } = req.body;
  if (!clienteId || !tipoId || !montoPagado || !fecha) {
    return res.status(400).json({ error: 'Campos requeridos: clienteId, tipoId, montoPagado, fecha' });
  }
  try {
    await query(
      `INSERT INTO Suscripcion
         (Cli_ID_Cliente, Tsu_ID_Tipo_Suscripcion, Sus_Fecha_Suscripcion, Sus_Monto_Pagado, Ess_ID_Estatus_Suscripcion)
       VALUES ($1, $2, $3, $4, $5)`,
      [clienteId, tipoId, fecha, montoPagado, estatusId || 1]
    );
    const rows = await query(
      `SELECT s.Sus_ID_Suscripcion AS id, c.Cli_Nombre AS cliente,
              t.Tsu_Nombre AS plan, s.Sus_Fecha_Suscripcion AS "fechaSuscripcion",
              s.Sus_Monto_Pagado AS "montoPagado", e.Ess_Nombre AS estatus
       FROM Suscripcion s
       JOIN Clientes            c ON s.Cli_ID_Cliente             = c.Cli_ID_Cliente
       JOIN Tipo_Suscripcion    t ON s.Tsu_ID_Tipo_Suscripcion    = t.Tsu_ID_Tipo_Suscripcion
       JOIN Estatus_Suscripcion e ON s.Ess_ID_Estatus_Suscripcion = e.Ess_ID_Estatus_Suscripcion
       ORDER BY s.Sus_ID_Suscripcion DESC LIMIT 1`
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Subscription create error:', err.message);
    res.status(500).json({ error: 'Error al crear la suscripción' });
  }
});

// Editar suscripción
app.put('/api/subscriptions/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { tipoId, montoPagado, fecha, estatusId } = req.body;
  if (!tipoId || !montoPagado || !fecha || !estatusId) {
    return res.status(400).json({ error: 'Campos requeridos: tipoId, montoPagado, fecha, estatusId' });
  }
  try {
    const result = await query(
      `UPDATE Suscripcion
       SET Tsu_ID_Tipo_Suscripcion    = $1,
           Sus_Monto_Pagado           = $2,
           Sus_Fecha_Suscripcion      = $3,
           Ess_ID_Estatus_Suscripcion = $4
       WHERE Sus_ID_Suscripcion = $5`,
      [tipoId, montoPagado, fecha, estatusId, id]
    );
    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ error: 'Suscripción no encontrada' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Subscription update error:', err.message);
    res.status(500).json({ error: 'Error al actualizar la suscripción' });
  }
});

// Renovar suscripción (nueva fecha + estatus Activa)
app.put('/api/subscriptions/:id/renovar', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { tipoId, montoPagado, fecha } = req.body;
  if (!tipoId || !montoPagado || !fecha) {
    return res.status(400).json({ error: 'Campos requeridos: tipoId, montoPagado, fecha' });
  }
  try {
    // Estatus 1 = Activa
    await query(
      `UPDATE Suscripcion
       SET Tsu_ID_Tipo_Suscripcion    = $1,
           Sus_Monto_Pagado           = $2,
           Sus_Fecha_Suscripcion      = $3,
           Ess_ID_Estatus_Suscripcion = 1
       WHERE Sus_ID_Suscripcion = $4`,
      [tipoId, montoPagado, fecha, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Subscription renovar error:', err.message);
    res.status(500).json({ error: 'Error al renovar la suscripción' });
  }
});


// ========================
// VENCIMIENTOS AUTOMÁTICOS
// ========================
async function checkVencimientos() {
  try {
    const result = await query(
      `UPDATE Suscripcion s
       SET Ess_ID_Estatus_Suscripcion = 2
       FROM Tipo_Suscripcion t
       WHERE s.Tsu_ID_Tipo_Suscripcion    = t.Tsu_ID_Tipo_Suscripcion
         AND s.Ess_ID_Estatus_Suscripcion = 1
         AND (s.Sus_Fecha_Suscripcion + (t.Tsu_Duracion_Dias || ' days')::interval)::date < CURRENT_DATE
       RETURNING s.Sus_ID_Suscripcion AS id`
    );
    if (result.length > 0) {
      console.log(`[Vencimientos] ${result.length} suscripción(es) marcada(s) como Vencida.`);
    }
    return result.length;
  } catch (err) {
    console.error('[Vencimientos] Error:', err.message);
    return 0;
  }
}

// Ejecutar al arrancar y luego cada 24 horas
checkVencimientos();
setInterval(checkVencimientos, 24 * 60 * 60 * 1000);

// Endpoint para disparo manual desde la UI
app.post('/api/subscriptions/verificar-vencimientos', authMiddleware, async (req, res) => {
  const vencidas = await checkVencimientos();
  res.json({ vencidas, mensaje: vencidas > 0 ? `${vencidas} suscripción(es) marcada(s) como Vencida` : 'No hay suscripciones por vencer' });
});

// ========================
// CORREOS DE SUSCRIPCIÓN
// ========================

// Listar correos de una suscripción
app.get('/api/subscriptions/:id/correos', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await query(
      `SELECT Csu_ID_Correo       AS id,
              Sus_ID_Suscripcion  AS "susId",
              Csu_Correo          AS correo,
              Csu_Nombre_Contacto AS nombre,
              Csu_Es_Principal    AS principal,
              Csu_Fecha_Registro  AS fecha
       FROM Correo_Suscripcion
       WHERE Sus_ID_Suscripcion = $1
       ORDER BY Csu_Es_Principal DESC, Csu_ID_Correo ASC`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Correos list error:', err.message);
    res.status(500).json([]);
  }
});

// Agregar correo a una suscripción
app.post('/api/subscriptions/:id/correos', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { correo, nombre, principal } = req.body;
  if (!correo || !correo.trim()) {
    return res.status(400).json({ error: 'El correo es requerido' });
  }
  try {
    // Si es principal, quitar principal de los demás
    if (principal) {
      await query(
        'UPDATE Correo_Suscripcion SET Csu_Es_Principal = FALSE WHERE Sus_ID_Suscripcion = $1',
        [id]
      );
    }
    await query(
      `INSERT INTO Correo_Suscripcion
         (Sus_ID_Suscripcion, Csu_Correo, Csu_Nombre_Contacto, Csu_Es_Principal)
       VALUES ($1, $2, $3, $4)`,
      [id, correo.trim(), nombre?.trim() || null, !!principal]
    );
    const rows = await query(
      `SELECT Csu_ID_Correo AS id, Sus_ID_Suscripcion AS "susId",
              Csu_Correo AS correo, Csu_Nombre_Contacto AS nombre,
              Csu_Es_Principal AS principal, Csu_Fecha_Registro AS fecha
       FROM Correo_Suscripcion
       WHERE Sus_ID_Suscripcion = $1 ORDER BY Csu_ID_Correo DESC LIMIT 1`,
      [id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.message?.includes('unique') || err.code === '23505') {
      return res.status(409).json({ error: 'Este correo ya está registrado en esta suscripción' });
    }
    console.error('Correo create error:', err.message);
    res.status(500).json({ error: 'Error al agregar el correo' });
  }
});

// Marcar correo como principal
app.put('/api/subscriptions/:susId/correos/:id/principal', authMiddleware, async (req, res) => {
  const { susId, id } = req.params;
  try {
    await query(
      'UPDATE Correo_Suscripcion SET Csu_Es_Principal = FALSE WHERE Sus_ID_Suscripcion = $1',
      [susId]
    );
    await query(
      'UPDATE Correo_Suscripcion SET Csu_Es_Principal = TRUE WHERE Csu_ID_Correo = $1',
      [id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Correo principal error:', err.message);
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

// Eliminar correo
app.delete('/api/subscriptions/correos/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM Correo_Suscripcion WHERE Csu_ID_Correo = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Correo delete error:', err.message);
    res.status(500).json({ error: 'Error al eliminar' });
  }
});



// ============================================================
// SECCIÓN 12: CATÁLOGOS (CRUD genérico)
// CATALOG_MAP mapea cada key (ej. "concepto-gasto") a la tabla real
// y los nombres de sus columnas ID y Nombre.
// GET /api/catalogos → trae TODOS los catálogos en un solo request (útil en Catalogos.tsx)
// POST/PUT/DELETE /api/catalogos/:key/:id → CRUD genérico usando CATALOG_MAP
// tipo-suscripcion es especial: tiene 3 columnas extra (nombre, duracion, precio).
// El INSERT usa generate_series para encontrar el próximo ID libre (sin gaps).
// ============================================================
const CATALOG_MAP = {
  'concepto-gasto':      { table: 'Concepto_Gasto',      id: 'Cgs_ID_Concepto_Gasto',      col: 'Cgs_Nombre' },
  'forma-gasto':         { table: 'Forma_Gasto',          id: 'Fgs_ID_Forma_Gasto',          col: 'Fgs_Nombre' },
  'estatus-gasto':       { table: 'Estatus_Gasto',        id: 'Egs_ID_Estatus_Gasto',        col: 'Egs_Nombre' },
  'concepto-ingreso':    { table: 'Concepto_Ingreso',     id: 'Cin_ID_Concepto_Ingreso',      col: 'Cin_Nombre' },
  'forma-ingreso':       { table: 'Forma_Ingreso',        id: 'Fin_ID_Forma_Ingreso',         col: 'Fin_Nombre' },
  'estatus-ingreso':     { table: 'Estatus_Ingreso',      id: 'Ein_ID_Estatus_Ingreso',       col: 'Ein_Nombre' },
  'tipo-cliente':        { table: 'Tipo_Cliente',         id: 'Tpc_ID_Tipo_Cliente',          col: 'Tpc_Nombre' },
  'tipo-documento':      { table: 'Tipo_Documento',       id: 'Tdd_ID_Tipo_Documento',        col: 'Tdd_Nombre_Tipo' },
  'estado-proyecto':     { table: 'Estado_Proyecto',      id: 'Epr_ID_Estatus_Proyecto',      col: 'Epr_Nombre_Estatus' },
  'puesto-proyecto':     { table: 'Puesto_Proyecto',      id: 'Ppr_ID_Puesto_Proyecto',       col: 'Ppr_Nombre_Puesto' },
  'proveedor':           { table: 'Proveedor',            id: 'Prv_ID_Proveedor',             col: 'Prv_Nombre_Proveedor' },
  'estatus-suscripcion': { table: 'Estatus_Suscripcion',  id: 'Ess_ID_Estatus_Suscripcion',   col: 'Ess_Nombre' },
};

app.get('/api/catalogos', authMiddleware, async (req, res) => {
  try {
    const results = {};
    await Promise.all(Object.entries(CATALOG_MAP).map(async ([key, m]) => {
      const rows = await query(`SELECT ${m.id} AS id, ${m.col} AS nombre FROM ${m.table} ORDER BY ${m.col}`);
      results[key] = rows;
    }));
    // Tipo_Suscripcion aparte (campos extra)
    results['tipo-suscripcion'] = await query(
      'SELECT Tsu_ID_Tipo_Suscripcion AS id, Tsu_Nombre AS nombre, Tsu_Duracion_Dias AS duracion, Tsu_Precio AS precio FROM Tipo_Suscripcion ORDER BY Tsu_Nombre'
    );
    res.json(results);
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Error al cargar catálogos' }); }
});

app.post('/api/catalogos/:key', authMiddleware, async (req, res) => {
  const m = CATALOG_MAP[req.params.key];
  if (req.params.key === 'tipo-suscripcion') {
    const { nombre, duracion, precio } = req.body;
    if (!nombre || !duracion || !precio) return res.status(400).json({ error: 'Nombre, duración y precio son requeridos' });
    try {
      const nxt = await query(`SELECT COALESCE((SELECT MIN(gs) FROM generate_series(1,(SELECT COALESCE(MAX(Tsu_ID_Tipo_Suscripcion),0)+1 FROM Tipo_Suscripcion)) gs LEFT JOIN Tipo_Suscripcion ON Tsu_ID_Tipo_Suscripcion=gs WHERE Tsu_ID_Tipo_Suscripcion IS NULL),1) AS nid`);
      const nid = nxt[0].nid;
      const r = await query(
        'INSERT INTO Tipo_Suscripcion (Tsu_ID_Tipo_Suscripcion, Tsu_Nombre, Tsu_Duracion_Dias, Tsu_Precio) VALUES ($1,$2,$3,$4) RETURNING Tsu_ID_Tipo_Suscripcion AS id',
        [nid, nombre, Number(duracion), Number(precio)]
      );
      await query(`SELECT setval(pg_get_serial_sequence('Tipo_Suscripcion','Tsu_ID_Tipo_Suscripcion'), GREATEST((SELECT MAX(Tsu_ID_Tipo_Suscripcion) FROM Tipo_Suscripcion), 1))`);
      res.status(201).json({ id: r[0].id, nombre, duracion: Number(duracion), precio: Number(precio) });
    } catch (err) { console.error(err.message); res.status(500).json({ error: 'Error al crear' }); }
    return;
  }
  if (!m) return res.status(404).json({ error: 'Catálogo no encontrado' });
  const { nombre } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const nxt = await query(`SELECT COALESCE((SELECT MIN(gs) FROM generate_series(1,(SELECT COALESCE(MAX(${m.id}),0)+1 FROM ${m.table})) gs LEFT JOIN ${m.table} ON ${m.id}=gs WHERE ${m.id} IS NULL),1) AS nid`);
    const nid = nxt[0].nid;
    const r = await query(`INSERT INTO ${m.table} (${m.id}, ${m.col}) VALUES ($1,$2) RETURNING ${m.id} AS id`, [nid, nombre.trim()]);
    await query(`SELECT setval(pg_get_serial_sequence('${m.table}','${m.id}'), GREATEST((SELECT MAX(${m.id}) FROM ${m.table}), 1))`);
    res.status(201).json({ id: r[0].id, nombre: nombre.trim() });
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Error al crear' }); }
});

app.put('/api/catalogos/:key/:id', authMiddleware, async (req, res) => {
  if (req.params.key === 'tipo-suscripcion') {
    const { nombre, duracion, precio } = req.body;
    if (!nombre || !duracion || !precio) return res.status(400).json({ error: 'Nombre, duración y precio son requeridos' });
    try {
      await query('UPDATE Tipo_Suscripcion SET Tsu_Nombre=$1, Tsu_Duracion_Dias=$2, Tsu_Precio=$3 WHERE Tsu_ID_Tipo_Suscripcion=$4',
        [nombre, Number(duracion), Number(precio), req.params.id]);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Error al actualizar' }); }
    return;
  }
  const m = CATALOG_MAP[req.params.key];
  if (!m) return res.status(404).json({ error: 'Catálogo no encontrado' });
  const { nombre } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    await query(`UPDATE ${m.table} SET ${m.col}=$1 WHERE ${m.id}=$2`, [nombre.trim(), req.params.id]);
    res.json({ success: true });
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Error al actualizar' }); }
});

app.delete('/api/catalogos/:key/:id', authMiddleware, async (req, res) => {
  const m = req.params.key === 'tipo-suscripcion'
    ? { table: 'Tipo_Suscripcion', id: 'Tsu_ID_Tipo_Suscripcion' }
    : CATALOG_MAP[req.params.key];
  if (!m) return res.status(404).json({ error: 'Catálogo no encontrado' });
  try {
    await query(`DELETE FROM ${m.table} WHERE ${m.id}=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'No se puede eliminar, puede estar en uso por otros registros' });
  }
});

// ============================================================
// SECCIÓN 13: REPORTES
// Datos para los PDFs exportables desde Reports.tsx.
// Cada endpoint devuelve un array de filas con los datos del reporte.
// Los filtros se pasan como query params (?year=2025, ?fechaInicio=..., etc.)
//   ingresos-gastos        → comparativa mensual por año
//   proyectos-cliente      → proyectos con cliente, costo y estado
//   suscripciones-activas  → suscripciones activas con cliente y vigencia
//   rentabilidad-proyectos → costo vs ingresos por proyecto (utilidad)
//   gastos-concepto        → gastos agrupados por concepto (año)
//   clientes-activos       → clientes activos con tipo y fecha de registro
// ============================================================

app.get('/api/reportes/ingresos-gastos', authMiddleware, async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  try {
    const [ingresos, gastos] = await Promise.all([
      query(`SELECT EXTRACT(MONTH FROM Ing_Fecha_Ingreso)::int AS mes, SUM(Ing_Monto) AS total
             FROM Ingresos WHERE EXTRACT(YEAR FROM Ing_Fecha_Ingreso) = $1 GROUP BY mes ORDER BY mes`, [year]),
      query(`SELECT EXTRACT(MONTH FROM Gas_Fecha_Gasto)::int AS mes, SUM(Gas_Monto) AS total
             FROM Gasto WHERE EXTRACT(YEAR FROM Gas_Fecha_Gasto) = $1 GROUP BY mes ORDER BY mes`, [year])
    ]);
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const data = meses.map((nombre, i) => {
      const m = i + 1;
      return {
        mes: nombre,
        ingresos: Number(ingresos.find(r => r.mes === m)?.total || 0),
        gastos:   Number(gastos.find(r => r.mes === m)?.total   || 0),
      };
    });
    res.json(data);
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Error' }); }
});

app.get('/api/reportes/proyectos-cliente', authMiddleware, async (req, res) => {
  try {
    const rows = await query(`
      SELECT c.Cli_ID_Cliente AS id, c.Cli_Nombre AS cliente,
             COUNT(p.Pro_ID_Proyecto)              AS proyectos,
             SUM(p.Pro_Costo_Proyecto)             AS "costoTotal",
             SUM(COALESCE(i.total_ing, 0))         AS "totalIngresos"
      FROM Clientes c
      LEFT JOIN Proyecto p ON p.Cli_ID_Cliente = c.Cli_ID_Cliente
      LEFT JOIN (
        SELECT Pro_ID_Proyecto, SUM(Ing_Monto) AS total_ing FROM Ingresos GROUP BY Pro_ID_Proyecto
      ) i ON i.Pro_ID_Proyecto = p.Pro_ID_Proyecto
      GROUP BY c.Cli_ID_Cliente, c.Cli_Nombre
      ORDER BY proyectos DESC, "costoTotal" DESC`);
    res.json(rows.map(r => ({ ...r, proyectos: Number(r.proyectos), costoTotal: Number(r.costoTotal || 0), totalIngresos: Number(r.totalIngresos || 0) })));
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Error' }); }
});

app.get('/api/reportes/suscripciones-activas', authMiddleware, async (req, res) => {
  try {
    const rows = await query(`
      SELECT s.Sus_ID_Suscripcion AS id,
             c.Cli_Nombre         AS cliente,
             t.Tsu_Nombre         AS plan,
             t.Tsu_Precio         AS precio,
             t.Tsu_Duracion_Dias  AS "duracionDias",
             s.Sus_Fecha_Suscripcion AS "fechaInicio",
             (s.Sus_Fecha_Suscripcion + (t.Tsu_Duracion_Dias || ' days')::interval)::date AS "fechaVencimiento",
             e.Ess_Nombre         AS estatus,
             s.Sus_Monto_Pagado   AS "montoPagado"
      FROM Suscripcion s
      JOIN Clientes c              ON s.Cli_ID_Cliente             = c.Cli_ID_Cliente
      JOIN Tipo_Suscripcion t      ON s.Tsu_ID_Tipo_Suscripcion    = t.Tsu_ID_Tipo_Suscripcion
      JOIN Estatus_Suscripcion e   ON s.Ess_ID_Estatus_Suscripcion = e.Ess_ID_Estatus_Suscripcion
      ORDER BY "fechaVencimiento" ASC`);
    res.json(rows);
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Error' }); }
});

app.get('/api/reportes/rentabilidad-proyectos', authMiddleware, async (req, res) => {
  try {
    const rows = await query(`
      SELECT p.Pro_ID_Proyecto          AS id,
             p.Pro_Nombre               AS nombre,
             COALESCE(p.Pro_Costo_Proyecto, 0) AS costo,
             COALESCE(ing.total, 0)     AS ingresos,
             COALESCE(gas.total, 0)     AS gastos,
             COALESCE(ing.total, 0) - COALESCE(gas.total, 0) AS utilidad,
             e.Epr_Nombre_Estatus       AS estatus,
             c.Cli_Nombre               AS cliente
      FROM Proyecto p
      LEFT JOIN Estado_Proyecto e ON p.Epr_ID_Estatus_Proyecto = e.Epr_ID_Estatus_Proyecto
      LEFT JOIN Clientes c         ON p.Cli_ID_Cliente           = c.Cli_ID_Cliente
      LEFT JOIN (SELECT Pro_ID_Proyecto, SUM(Ing_Monto) AS total FROM Ingresos GROUP BY Pro_ID_Proyecto) ing
             ON ing.Pro_ID_Proyecto = p.Pro_ID_Proyecto
      LEFT JOIN (SELECT Pro_ID_Proyecto, SUM(Gas_Monto) AS total FROM Gasto GROUP BY Pro_ID_Proyecto) gas
             ON gas.Pro_ID_Proyecto = p.Pro_ID_Proyecto
      ORDER BY utilidad DESC`);
    res.json(rows.map(r => ({
      ...r, costo: Number(r.costo), ingresos: Number(r.ingresos),
      gastos: Number(r.gastos), utilidad: Number(r.utilidad)
    })));
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Error' }); }
});

app.get('/api/reportes/gastos-concepto', authMiddleware, async (req, res) => {
  try {
    const rows = await query(`
      SELECT c.Cgs_Nombre AS concepto,
             COUNT(g.Gas_ID_Gasto)::int AS cantidad,
             SUM(g.Gas_Monto)           AS total
      FROM Gasto g
      JOIN Concepto_Gasto c ON g.Cgs_ID_Concepto_Gasto = c.Cgs_ID_Concepto_Gasto
      GROUP BY c.Cgs_Nombre
      ORDER BY total DESC`);
    const grandTotal = rows.reduce((s, r) => s + Number(r.total), 0);
    res.json(rows.map(r => ({ ...r, total: Number(r.total), porcentaje: grandTotal > 0 ? ((Number(r.total) / grandTotal) * 100).toFixed(1) : '0' })));
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Error' }); }
});

app.get('/api/reportes/clientes-activos', authMiddleware, async (req, res) => {
  try {
    const rows = await query(`
      SELECT c.Cli_ID_Cliente AS id,
             c.Cli_Nombre     AS cliente,
             c.Cli_Tipo       AS tipo,
             COUNT(DISTINCT p.Pro_ID_Proyecto)::int        AS proyectos,
             COALESCE(SUM(p.Pro_Costo_Proyecto), 0)        AS "valorProyectos",
             COUNT(DISTINCT s.Sus_ID_Suscripcion)::int     AS suscripciones,
             COALESCE(SUM(s.Sus_Monto_Pagado), 0)          AS "totalSuscripciones"
      FROM Clientes c
      LEFT JOIN Proyecto    p ON p.Cli_ID_Cliente = c.Cli_ID_Cliente
      LEFT JOIN Suscripcion s ON s.Cli_ID_Cliente = c.Cli_ID_Cliente
      GROUP BY c.Cli_ID_Cliente, c.Cli_Nombre, c.Cli_Tipo
      ORDER BY proyectos DESC, suscripciones DESC`);
    res.json(rows.map(r => ({ ...r, valorProyectos: Number(r.valorProyectos), totalSuscripciones: Number(r.totalSuscripciones) })));
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Error' }); }
});

// Reporte: Suscripciones por Cliente
app.get('/api/reportes/suscripciones-cliente', authMiddleware, async (req, res) => {
  try {
    const rows = await query(`
      SELECT c.cli_nombre AS cliente,
             COUNT(s.sus_id_suscripcion)::int AS total_suscripciones,
             COALESCE(SUM(s.sus_monto_pagado), 0) AS total_pagado
      FROM Clientes c
      LEFT JOIN Suscripcion s ON c.cli_id_cliente = s.cli_id_cliente
      GROUP BY c.cli_id_cliente, c.cli_nombre
      ORDER BY total_suscripciones DESC`);
    res.json(rows.map(r => ({ ...r, total_pagado: Number(r.total_pagado) })));
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Error' }); }
});

app.get('/api/reportes/suscripciones-cliente', authMiddleware, async (req, res) => {
  try {
    const rows = await query(`
      SELECT c.cli_nombre AS cliente,
  COUNT(s.sus_id_suscripcion) AS total_suscripciones,
  SUM(s.sus_monto_pagado) AS total_pagado
FROM clientes c
LEFT JOIN suscripcion s ON c.cli_id_cliente = s.cli_id_cliente
GROUP BY c.cli_id_cliente, c.cli_nombre
ORDER BY total_suscripciones DESC;`);
    res.json(rows.map(r => ({ ...r, total_pagado: Number(r.total_pagado) })));
  } catch (err) { console.error(err.message); res.status(500).json({ error: 'Error' }); }
});

// ============================================================
// SECCIÓN 14: DASHBOARD STATS
// Endpoint: GET /api/dashboard/stats
// Ejecuta 16 queries en paralelo con Promise.all para maximizar velocidad.
// Retorna un objeto con:
//   kpis → 7 métricas calculadas con EXTRACT(MONTH/YEAR FROM ...) y CURRENT_DATE
//   ingresosGastosMes → array de 12 meses con ingresos y gastos (merged con Map)
//   projectStatus      → conteo de proyectos por estatus
//   suscripcionesEstatus → conteo de suscripciones por estatus
//   gastosConcepto     → top gastos agrupados por concepto (año actual)
//   clientesByType     → clientes agrupados por tipo
//   projectProgress    → iniciados y terminados por mes
//   commissions        → filas de comisiones (no se usa en gráficas, pero sigue aquí)
// Nota: ingresosGastosMes usa un Map keyed por mes (1-12) y solo incluye
//   meses desde Ene hasta el mes actual (para no mostrar meses futuros en 0).
// ============================================================
app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const [
      projectStatusRows,
      commissionsRows,
      projectIniciadosRows,
      projectTerminadosRows,
      clientesByTypeRows,
      ingresosMesActualRow,
      gastosMesActualRow,
      ingresosAnoRow,
      gastosAnoRow,
      susActivasRow,
      clientesActivosRow,
      proyectosActivosRow,
      ingresosXMesRows,
      gastosXMesRows,
      gastosConceptoRows,
      suscripcionesEstatusRows
    ] = await Promise.all([
      // Estado de Proyectos (donut)
      query(`SELECT e.Epr_Nombre_Estatus AS name, COUNT(p.Pro_ID_Proyecto)::int AS value
             FROM Estado_Proyecto e
             LEFT JOIN Proyecto p ON e.Epr_ID_Estatus_Proyecto = p.Epr_ID_Estatus_Proyecto
             GROUP BY e.Epr_Nombre_Estatus`),
      // Comisiones por estatus
      query(`SELECT e.Egs_Nombre AS name, COALESCE(SUM(g.Gas_Monto), 0)::numeric AS value
             FROM Estatus_Gasto e
             LEFT JOIN Gasto g ON g.Egs_ID_Estatus_Gasto = e.Egs_ID_Estatus_Gasto
             LEFT JOIN Concepto_Gasto c ON g.Cgs_ID_Concepto_Gasto = c.Cgs_ID_Concepto_Gasto AND c.Cgs_Nombre = 'Comisiones'
             GROUP BY e.Egs_Nombre`),
      // Proyectos iniciados por mes
      query(`SELECT TO_CHAR(Pro_Fecha_Inicio, 'TMMon') AS month, COUNT(*)::int AS iniciados,
                    EXTRACT(MONTH FROM Pro_Fecha_Inicio)::int AS m_order
             FROM Proyecto WHERE Pro_Fecha_Inicio IS NOT NULL
             GROUP BY month, m_order`),
      // Proyectos terminados por mes
      query(`SELECT TO_CHAR(Pro_Fecha_Finalizacion, 'TMMon') AS month, COUNT(*)::int AS terminados,
                    EXTRACT(MONTH FROM Pro_Fecha_Finalizacion)::int AS m_order
             FROM Proyecto WHERE Pro_Fecha_Finalizacion IS NOT NULL
             GROUP BY month, m_order`),
      // Clientes por tipo
      query(`SELECT t.Tpc_Nombre AS name, COUNT(c.Cli_ID_Cliente)::int AS value
             FROM Tipo_Cliente t
             LEFT JOIN Clientes c ON t.Tpc_ID_Tipo_Cliente = c.Tpc_ID_Tipo_Cliente
             GROUP BY t.Tpc_Nombre`),
      // KPI: Ingresos mes actual
      query(`SELECT COALESCE(SUM(Ing_Monto), 0)::numeric AS total FROM Ingresos
             WHERE EXTRACT(MONTH FROM Ing_Fecha_Ingreso) = EXTRACT(MONTH FROM CURRENT_DATE)
               AND EXTRACT(YEAR  FROM Ing_Fecha_Ingreso) = EXTRACT(YEAR  FROM CURRENT_DATE)`),
      // KPI: Gastos mes actual
      query(`SELECT COALESCE(SUM(Gas_Monto), 0)::numeric AS total FROM Gasto
             WHERE EXTRACT(MONTH FROM Gas_Fecha_Gasto) = EXTRACT(MONTH FROM CURRENT_DATE)
               AND EXTRACT(YEAR  FROM Gas_Fecha_Gasto) = EXTRACT(YEAR  FROM CURRENT_DATE)`),
      // KPI: Ingresos año actual
      query(`SELECT COALESCE(SUM(Ing_Monto), 0)::numeric AS total FROM Ingresos
             WHERE EXTRACT(YEAR FROM Ing_Fecha_Ingreso) = EXTRACT(YEAR FROM CURRENT_DATE)`),
      // KPI: Gastos año actual
      query(`SELECT COALESCE(SUM(Gas_Monto), 0)::numeric AS total FROM Gasto
             WHERE EXTRACT(YEAR FROM Gas_Fecha_Gasto) = EXTRACT(YEAR FROM CURRENT_DATE)`),
      // KPI: Suscripciones activas
      query(`SELECT COUNT(*)::int AS total FROM Suscripcion WHERE Ess_ID_Estatus_Suscripcion = 1`),
      // KPI: Clientes activos
      query(`SELECT COUNT(*)::int AS total FROM Clientes WHERE Cli_Estatus = true`),
      // KPI: Proyectos activos (no terminados)
      query(`SELECT COUNT(p.Pro_ID_Proyecto)::int AS total FROM Proyecto p
             JOIN Estado_Proyecto e ON e.Epr_ID_Estatus_Proyecto = p.Epr_ID_Estatus_Proyecto
             WHERE LOWER(e.Epr_Nombre_Estatus) NOT IN ('terminado','terminados','cancelado','cancelados')`),
      // Ingresos por mes (año actual)
      query(`SELECT EXTRACT(MONTH FROM Ing_Fecha_Ingreso)::int AS mes,
                    COALESCE(SUM(Ing_Monto), 0)::numeric AS ingresos
             FROM Ingresos
             WHERE EXTRACT(YEAR FROM Ing_Fecha_Ingreso) = EXTRACT(YEAR FROM CURRENT_DATE)
             GROUP BY mes ORDER BY mes`),
      // Gastos por mes (año actual)
      query(`SELECT EXTRACT(MONTH FROM Gas_Fecha_Gasto)::int AS mes,
                    COALESCE(SUM(Gas_Monto), 0)::numeric AS gastos
             FROM Gasto
             WHERE EXTRACT(YEAR FROM Gas_Fecha_Gasto) = EXTRACT(YEAR FROM CURRENT_DATE)
             GROUP BY mes ORDER BY mes`),
      // Gastos por concepto (top 6)
      query(`SELECT c.Cgs_Nombre AS name, COALESCE(SUM(g.Gas_Monto), 0)::numeric AS value
             FROM Concepto_Gasto c
             LEFT JOIN Gasto g ON g.Cgs_ID_Concepto_Gasto = c.Cgs_ID_Concepto_Gasto
             GROUP BY c.Cgs_Nombre ORDER BY value DESC LIMIT 6`),
      // Suscripciones por estatus
      query(`SELECT e.Ess_Nombre AS name, COUNT(s.Sus_ID_Suscripcion)::int AS value
             FROM Estatus_Suscripcion e
             LEFT JOIN Suscripcion s ON s.Ess_ID_Estatus_Suscripcion = e.Ess_ID_Estatus_Suscripcion
             GROUP BY e.Ess_Nombre`)
    ]);

    // Build project progress map
    const progressMap = new Map();
    projectIniciadosRows.forEach(r => {
      progressMap.set(r.month, { month: r.month, iniciados: r.iniciados, terminados: 0, order: r.m_order });
    });
    projectTerminadosRows.forEach(r => {
      if (progressMap.has(r.month)) progressMap.get(r.month).terminados = r.terminados;
      else progressMap.set(r.month, { month: r.month, iniciados: 0, terminados: r.terminados, order: r.m_order });
    });
    const projectProgress = Array.from(progressMap.values()).sort((a, b) => a.order - b.order);

    // Build ingresos+gastos by month (current year, up to current month)
    const currentMonth = new Date().getMonth() + 1;
    const igMap = new Map();
    for (let m = 1; m <= currentMonth; m++) {
      igMap.set(m, { month: MESES_ES[m - 1], ingresos: 0, gastos: 0 });
    }
    ingresosXMesRows.forEach(r => { if (igMap.has(r.mes)) igMap.get(r.mes).ingresos = Number(r.ingresos); });
    gastosXMesRows.forEach(r => { if (igMap.has(r.mes)) igMap.get(r.mes).gastos = Number(r.gastos); });
    const ingresosGastosMes = Array.from(igMap.values());

    res.json({
      kpis: {
        ingresosMesActual:    Number(ingresosMesActualRow[0]?.total  || 0),
        gastosMesActual:      Number(gastosMesActualRow[0]?.total    || 0),
        ingresosAno:          Number(ingresosAnoRow[0]?.total        || 0),
        gastosAno:            Number(gastosAnoRow[0]?.total          || 0),
        suscripcionesActivas: Number(susActivasRow[0]?.total         || 0),
        clientesActivos:      Number(clientesActivosRow[0]?.total    || 0),
        proyectosActivos:     Number(proyectosActivosRow[0]?.total   || 0),
      },
      ingresosGastosMes,
      projectStatus:         projectStatusRows,
      suscripcionesEstatus:  suscripcionesEstatusRows,
      gastosConcepto:        gastosConceptoRows.map(r => ({ ...r, value: Number(r.value) })),
      clientesByType:        clientesByTypeRows,
      projectProgress,
      commissions:           commissionsRows,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err.message);
    res.status(500).json({ error: 'Error al cargar estadísticas' });
  }
});

// ============================================================
// SECCIÓN 15: SERVIR FRONTEND EN PRODUCCIÓN
// En desarrollo, el cliente corre en Vite (puerto 5173) con proxy.
// En producción (npm run build), los archivos compilados quedan en
// client/dist/ y este bloque los sirve directamente.
// Cualquier ruta que no sea /api se redirige a index.html (SPA).
// ============================================================
const distPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// ============================================================
// INICIO DEL SERVIDOR
// Escucha en 0.0.0.0 para ser accesible desde la red local.
// Imprime la IP local al arrancar para facilitar acceso desde otros equipos.
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  let localIP = 'localhost';
  for (const name of Object.keys(os.networkInterfaces())) {
    for (const iface of os.networkInterfaces()[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
  }
  console.log('');
  console.log('===========================================');
  console.log('   SAPRO Dashboard Server');
  console.log('   Base de datos: script_sapro (PostgreSQL)');
  console.log('===========================================');
  console.log(`   Local:    http://localhost:${PORT}`);
  console.log(`   Red LAN:  http://${localIP}:${PORT}`);
  console.log('===========================================');
  console.log('');
  console.log('   Inicia sesión con un usuario de la tabla Login (Usu_Correo + Log_Contraseña)');
  console.log('   Ej: carlos.mendoza@cits.com.mx / Admin2026!');
  console.log('');
  console.log('   Presiona Ctrl+C para detener el servidor');
  console.log('');
});

