require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('./db.js');

const app = express();
const PORT = 4000;

// Middleware
app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + (file.originalname || 'documento.pdf');
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF'), false);
  },
  limits: { fileSize: 50 * 1024 * 1024 }
});

const validTokens = new Set();

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  // En desarrollo/demo, restauramos el token en memoria para que sobreviva a los reinicios del backend
  if (!validTokens.has(token)) {
    validTokens.add(token);
  }
  next();
}

// ========================
// AUTH (Login + Usuario)
// ========================
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
    const token = uuidv4();
    validTokens.add(token);
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

// ========================
// PASSWORDS (Login + Usuario → formato app: service, username, password)
// ========================
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

// ========================
// FILES / DOCUMENTOS (tabla Documento + carpeta uploads)
// ========================
app.post('/api/upload', authMiddleware, upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
  const { projectId = 1, tipoDocumentoId = 1, descripcion = '' } = req.body;
  try {
    await query(
      `INSERT INTO Documento (Doc_Nombre, Doc_Descripcion, Doc_Archivo, Pro_ID_Proyecto, Tdd_ID_Tipo_Documento)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.file.originalname || req.file.filename, descripcion, req.file.filename, projectId, tipoDocumentoId]
    );
    res.json({
      success: true,
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
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
    const rows = await query(
      `SELECT Doc_ID_Documento, Doc_Nombre, Doc_Archivo, Doc_Descripcion, Pro_ID_Proyecto
       FROM Documento ORDER BY Doc_ID_Documento DESC`
    );
    const files = rows.map(r => {
      const filePath = path.join(uploadsDir, r.doc_archivo);
      let size = 0;
      if (fs.existsSync(filePath)) size = fs.statSync(filePath).size;
      return {
        filename: r.doc_archivo,
        originalname: r.doc_nombre || r.doc_archivo,
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

// ========================
// PROJECTS (Proyecto) + Estado_Proyecto
// ========================
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
      `SELECT p.Pro_ID_Proyecto, p.Pro_Nombre, p.Pro_Descripcion, p.Pro_Fecha_Inicio, p.Pro_Fecha_Finalizacion,
              p.Pro_Costo_Proyecto, p.Epr_ID_Estatus_Proyecto, e.Epr_Nombre_Estatus AS estado
       FROM Proyecto p
       LEFT JOIN Estado_Proyecto e ON p.Epr_ID_Estatus_Proyecto = e.Epr_ID_Estatus_Proyecto
       ORDER BY p.Pro_Fecha_Inicio DESC`
    );
    const mapped = rows.map(r => ({
      Pro_ID_Proyecto: r.pro_id_proyecto,
      Pro_Nombre: r.pro_nombre,
      Pro_Descripcion: r.pro_descripcion,
      Pro_Fecha_Inicio: r.pro_fecha_inicio,
      Pro_Fecha_Finalizacion: r.pro_fecha_finalizacion,
      Pro_Costo_Proyecto: r.pro_costo_proyecto,
      Epr_ID_Estatus_Proyecto: r.epr_id_estatus_proyecto,
      estado: r.estado
    }));
    res.json(mapped);
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
      `SELECT p.Pro_ID_Proyecto, p.Pro_Nombre, p.Pro_Descripcion, p.Pro_Fecha_Inicio, p.Pro_Fecha_Finalizacion,
              p.Pro_Costo_Proyecto, p.Epr_ID_Estatus_Proyecto, e.Epr_Nombre_Estatus AS estado
       FROM Proyecto p
       LEFT JOIN Estado_Proyecto e ON p.Epr_ID_Estatus_Proyecto = e.Epr_ID_Estatus_Proyecto
       ORDER BY p.Pro_ID_Proyecto DESC LIMIT 1`
    );
    res.status(201).json({
      Pro_ID_Proyecto: rows[0].pro_id_proyecto,
      Pro_Nombre: rows[0].pro_nombre,
      Pro_Descripcion: rows[0].pro_descripcion,
      Pro_Fecha_Inicio: rows[0].pro_fecha_inicio,
      Pro_Fecha_Finalizacion: rows[0].pro_fecha_finalizacion,
      Pro_Costo_Proyecto: rows[0].pro_costo_proyecto,
      Epr_ID_Estatus_Proyecto: rows[0].epr_id_estatus_proyecto,
      estado: rows[0].estado
    });
  } catch (err) {
    console.error('Project create error:', err.message);
    res.status(500).json({ error: 'Error al crear el proyecto' });
  }
});

app.put('/api/projects/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, fechaInicio, fechaFin, costo, estadoId } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre del proyecto es requerido' });
  
  try {
    const fechaInicioVal = fechaInicio || new Date().toISOString().slice(0, 10);
    await query(
      `UPDATE Proyecto SET Pro_Nombre = $1, Pro_Descripcion = $2, Pro_Fecha_Inicio = $3, Pro_Fecha_Finalizacion = $4, Pro_Costo_Proyecto = $5, Epr_ID_Estatus_Proyecto = $6
       WHERE Pro_ID_Proyecto = $7`,
      [nombre.trim(), descripcion || null, fechaInicioVal, fechaFin || null, costo ? Number(costo) : null, estadoId ? Number(estadoId) : 1, id]
    );

    const rows = await query(
      `SELECT p.Pro_ID_Proyecto, p.Pro_Nombre, p.Pro_Descripcion, p.Pro_Fecha_Inicio, p.Pro_Fecha_Finalizacion,
              p.Pro_Costo_Proyecto, p.Epr_ID_Estatus_Proyecto, e.Epr_Nombre_Estatus AS estado
       FROM Proyecto p
       LEFT JOIN Estado_Proyecto e ON p.Epr_ID_Estatus_Proyecto = e.Epr_ID_Estatus_Proyecto
       WHERE p.Pro_ID_Proyecto = $1`, [id]
    );
    res.json({
      Pro_ID_Proyecto: rows[0].pro_id_proyecto,
      Pro_Nombre: rows[0].pro_nombre,
      Pro_Descripcion: rows[0].pro_descripcion,
      Pro_Fecha_Inicio: rows[0].pro_fecha_inicio,
      Pro_Fecha_Finalizacion: rows[0].pro_fecha_finalizacion,
      Pro_Costo_Proyecto: rows[0].pro_costo_proyecto,
      Epr_ID_Estatus_Proyecto: rows[0].epr_id_estatus_proyecto,
      estado: rows[0].estado
    });
  } catch (err) {
    console.error('Project update error:', err.message);
    res.status(500).json({ error: 'Error al actualizar el proyecto' });
  }
});

app.put('/api/projects/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, fechaInicio, fechaFin, costo, estadoId } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre del proyecto es requerido' });
  
  try {
    const fechaInicioVal = fechaInicio || new Date().toISOString().slice(0, 10);
    await query(
      `UPDATE Proyecto SET Pro_Nombre = $1, Pro_Descripcion = $2, Pro_Fecha_Inicio = $3, Pro_Fecha_Finalizacion = $4, Pro_Costo_Proyecto = $5, Epr_ID_Estatus_Proyecto = $6
       WHERE Pro_ID_Proyecto = $7`,
      [nombre.trim(), descripcion || null, fechaInicioVal, fechaFin || null, costo ? Number(costo) : null, estadoId ? Number(estadoId) : 1, id]
    );

    const rows = await query(
      `SELECT p.Pro_ID_Proyecto, p.Pro_Nombre, p.Pro_Descripcion, p.Pro_Fecha_Inicio, p.Pro_Fecha_Finalizacion,
              p.Pro_Costo_Proyecto, p.Epr_ID_Estatus_Proyecto, e.Epr_Nombre_Estatus AS estado
       FROM Proyecto p
       LEFT JOIN Estado_Proyecto e ON p.Epr_ID_Estatus_Proyecto = e.Epr_ID_Estatus_Proyecto
       WHERE p.Pro_ID_Proyecto = $1`, [id]
    );
    res.json({
      Pro_ID_Proyecto: rows[0].pro_id_proyecto,
      Pro_Nombre: rows[0].pro_nombre,
      Pro_Descripcion: rows[0].pro_descripcion,
      Pro_Fecha_Inicio: rows[0].pro_fecha_inicio,
      Pro_Fecha_Finalizacion: rows[0].pro_fecha_finalizacion,
      Pro_Costo_Proyecto: rows[0].pro_costo_proyecto,
      Epr_ID_Estatus_Proyecto: rows[0].epr_id_estatus_proyecto,
      estado: rows[0].estado
    });
  } catch (err) {
    console.error('Project update error:', err.message);
    res.status(500).json({ error: 'Error al actualizar el proyecto' });
  }
});

// ========================
// COMMISSIONS (Gasto donde concepto = Comisiones)
// ========================
app.get('/api/commissions', authMiddleware, async (req, res) => {
  try {
    const rows = await query(
      `SELECT g.Gas_ID_Gasto, g.Gas_Monto, g.Gas_Fecha_Gasto, g.Egs_ID_Estatus_Gasto, g.Gas_Comprobante_Gasto,
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
      let employee = [r.usu_nombre, r.usu_apellido].filter(Boolean).join(' ') || 'Sin nombre';
      let project = r.proyecto || '';
      let product = 'Comisión';
      let amount = Number(r.gas_monto) || 0;
      let commissionRate = 0;

      // Allow overriding with exact text from the JSON we saved
      if (r.gas_comprobante_gasto && r.gas_comprobante_gasto.startsWith('{')) {
        try {
          const extra = JSON.parse(r.gas_comprobante_gasto);
          if (extra.employee) employee = extra.employee;
          if (extra.project) project = extra.project;
          if (extra.product) product = extra.product;
          if (extra.amount) amount = extra.amount;
          if (extra.commissionRate) commissionRate = extra.commissionRate;
        } catch(e) {}
      }

      const status = statusMap[r.egs_id_estatus_gasto] || 'Pendiente';
      return {
        id: String(r.gas_id_gasto),
        employee,
        project,
        product,
        amount,
        commissionRate,
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

app.post('/api/commissions', authMiddleware, async (req, res) => {
  const { employee, project, product, amount, commissionRate, status } = req.body;
  try {
    // We try to fuzzy-match employee and project real IDs. Fallback to 1.
    let userId = 1;
    let projectId = 1;
    let conceptoId = 1;
    
    const users = await query('SELECT Usu_ID_Usuario, Usu_Nombre, Usu_Apellido FROM Usuario');
    const userMatch = users.find(u => `${u.usu_nombre} ${u.usu_apellido}`.toLowerCase().includes((employee || '').toLowerCase()));
    if (userMatch) userId = userMatch.usu_id_usuario;

    const projs = await query('SELECT Pro_ID_Proyecto, Pro_Nombre FROM Proyecto');
    const projMatch = projs.find(p => p.pro_nombre.toLowerCase() === (project || '').toLowerCase() || p.pro_nombre.toLowerCase().includes((project || '').toLowerCase()));
    if (projMatch) projectId = projMatch.pro_id_proyecto;

    const conceptos = await query(`SELECT Cgs_ID_Concepto_Gasto FROM Concepto_Gasto WHERE Cgs_Nombre = 'Comisiones' LIMIT 1`);
    if (conceptos.length) conceptoId = conceptos[0].cgs_id_concepto_gasto;

    const calculatedPay = (Number(amount) || 0) * ((Number(commissionRate) || 0) / 100);
    const estatusId = status === 'Pagada' ? 3 : 1; // 3 = Pagado, 1 = Pendiente
    const extraData = JSON.stringify({ employee, project, product, amount: Number(amount) || 0, commissionRate: Number(commissionRate) || 0 });

    const insertRes = await query(
      `INSERT INTO Gasto (Cgs_ID_Concepto_Gasto, Gas_Monto, Gas_Fecha_Gasto, Fgs_ID_Forma_Gasto, Gas_es_proveedor, Usu_ID_Usuario, Pro_ID_Proyecto, Egs_ID_Estatus_Gasto, Gas_Comprobante_Gasto)
       VALUES ($1, $2, CURRENT_DATE, $3, false, $4, $5, $6, $7) RETURNING Gas_ID_Gasto AS id`,
      [conceptoId, calculatedPay, 1, userId, projectId, estatusId, extraData]
    );

    res.json({ success: true, id: insertRes.length ? String(insertRes[0].id) : null });
  } catch (err) {
    console.error('Commissions create error:', err.message);
    res.status(500).json({ error: 'Error al crear la comisión' });
  }
});

app.put('/api/commissions/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { employee, project, product, amount, commissionRate } = req.body;
  try {
    const calculatedPay = (Number(amount) || 0) * ((Number(commissionRate) || 0) / 100);
    const extraData = JSON.stringify({ employee, project, product, amount: Number(amount) || 0, commissionRate: Number(commissionRate) || 0 });

    await query(
      `UPDATE Gasto SET Gas_Monto = $1, Gas_Comprobante_Gasto = $2 WHERE Gas_ID_Gasto = $3`,
      [calculatedPay, extraData, id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Commissions edit error:', err.message);
    res.status(500).json({ error: 'Error al editar la comisión' });
  }
});

app.put('/api/commissions/:id/pay', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    // 3 = Pagado
    await query(
      `UPDATE Gasto SET Egs_ID_Estatus_Gasto = 3, Gas_Fecha_Gasto = CURRENT_DATE WHERE Gas_ID_Gasto = $1`,
      [id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Commissions pay error:', err.message);
    res.status(500).json({ error: 'Error al pagar la comisión' });
  }
});

app.delete('/api/commissions/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query('DELETE FROM Gasto WHERE Gas_ID_Gasto = $1', [id]);
    if (!result || result.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ success: true });
  } catch (err) {
    console.error('Commissions delete error:', err.message);
    res.status(500).json({ error: 'Error al eliminar la comisión' });
  }
});

// ========================
// SERVE FRONTEND (production)
// ========================
const distPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// ========================
// START SERVER
// ========================
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
