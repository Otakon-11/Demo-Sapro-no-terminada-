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
  if (!token || !validTokens.has(token)) {
    return res.status(401).json({ error: 'No autorizado' });
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
       WHERE u.Usu_Correo = ? AND l.Log_Activo = 1
       LIMIT 1`,
      [username.trim()]
    );
    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    }
    const row = rows[0];
    if (row.Log_Contraseña !== password) {
      return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    }
    const displayName = [row.Usu_Nombre, row.Usu_Apellido].filter(Boolean).join(' ') || row.Usu_Correo;
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
      id: String(r.Log_ID),
      service: 'SAPRO',
      username: r.Usu_Correo || '',
      password: r.Log_Contraseña || '',
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
    const result = await query('UPDATE Login SET Log_Contraseña = ? WHERE Log_ID = ?', [password, id]);
    if (!result || result.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' });
    const rows = await query(
      `SELECT l.Log_ID, l.Log_Contraseña, u.Usu_Correo
       FROM Login l INNER JOIN Usuario u ON l.Usu_ID_Usuario = u.Usu_ID_Usuario WHERE l.Log_ID = ?`,
      [id]
    );
    const r = rows && rows[0];
    res.json({
      id: String(r.Log_ID),
      service: 'SAPRO',
      username: r.Usu_Correo || '',
      password: r.Log_Contraseña || '',
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
    const result = await query('UPDATE Login SET Log_Activo = 0 WHERE Log_ID = ?', [id]);
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
       VALUES (?, ?, ?, ?, ?)`,
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
      const filePath = path.join(uploadsDir, r.Doc_Archivo);
      let size = 0;
      if (fs.existsSync(filePath)) size = fs.statSync(filePath).size;
      return {
        filename: r.Doc_Archivo,
        originalname: r.Doc_Nombre || r.Doc_Archivo,
        size,
        uploadedAt: new Date().toISOString(),
        id: r.Doc_ID_Documento
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
    await query('DELETE FROM Documento WHERE Doc_Archivo = ?', [filename]);
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
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre.trim(), descripcion || null, fechaInicioVal, fechaFin || null, costo ? Number(costo) : null, estadoId ? Number(estadoId) : 1]
    );
    const rows = await query(
      `SELECT p.Pro_ID_Proyecto, p.Pro_Nombre, p.Pro_Descripcion, p.Pro_Fecha_Inicio, p.Pro_Fecha_Finalizacion,
              p.Pro_Costo_Proyecto, e.Epr_Nombre_Estatus AS estado
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

// ========================
// COMMISSIONS (Gasto donde concepto = Comisiones)
// ========================
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
        statusMap[r.Egs_ID_Estatus_Gasto] = r.Egs_Nombre === 'Pagado' ? 'Pagada' : (r.Egs_Nombre === 'Pendiente' ? 'Pendiente' : r.Egs_Nombre);
      });
    } catch (_) {}
    const list = rows.map(r => {
      const employee = [r.Usu_Nombre, r.Usu_Apellido].filter(Boolean).join(' ') || 'Sin nombre';
      const status = statusMap[r.Egs_ID_Estatus_Gasto] || 'Pendiente';
      return {
        id: String(r.Gas_ID_Gasto),
        employee,
        project: r.proyecto || '',
        product: 'Comisión',
        amount: Number(r.Gas_Monto) || 0,
        commissionRate: 0,
        status: status === 'Pagado' || status === 'Pagada' ? 'Pagada' : 'Pendiente',
        paymentDate: status === 'Pagada' ? (r.Gas_Fecha_Gasto ? String(r.Gas_Fecha_Gasto).slice(0, 10) : null) : null
      };
    });
    res.json(list);
  } catch (err) {
    console.error('Commissions list error:', err.message);
    res.status(500).json([]);
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
  console.log('   Base de datos: sistema_proyectos (MySQL)');
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
