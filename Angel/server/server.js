const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure data directories exist
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Passwords file path
const passwordsFile = path.join(dataDir, 'passwords.json');
if (!fs.existsSync(passwordsFile)) {
  fs.writeFileSync(passwordsFile, JSON.stringify([], null, 2));
}

// Multer config for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'), false);
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// Simple token store (in-memory, no DB)
const validTokens = new Set();

// Auth middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !validTokens.has(token)) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

// ========================
// AUTH ROUTES
// ========================
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'angel' && password === 'angel') {
    const token = uuidv4();
    validTokens.add(token);
    return res.json({ success: true, token, user: 'Angel' });
  }
  return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
});

app.post('/api/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) validTokens.delete(token);
  res.json({ success: true });
});

// ========================
// PASSWORD ROUTES
// ========================
function readPasswords() {
  try {
    return JSON.parse(fs.readFileSync(passwordsFile, 'utf-8'));
  } catch {
    return [];
  }
}

function writePasswords(data) {
  fs.writeFileSync(passwordsFile, JSON.stringify(data, null, 2));
}

app.get('/api/passwords', authMiddleware, (req, res) => {
  res.json(readPasswords());
});

app.post('/api/passwords', authMiddleware, (req, res) => {
  const { service, username, password } = req.body;
  if (!service || !username || !password) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }
  const passwords = readPasswords();
  const newEntry = { id: uuidv4(), service, username, password, createdAt: new Date().toISOString() };
  passwords.push(newEntry);
  writePasswords(passwords);
  res.json(newEntry);
});

app.put('/api/passwords/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { service, username, password } = req.body;
  const passwords = readPasswords();
  const index = passwords.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: 'No encontrado' });
  passwords[index] = { ...passwords[index], service, username, password };
  writePasswords(passwords);
  res.json(passwords[index]);
});

app.delete('/api/passwords/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  let passwords = readPasswords();
  passwords = passwords.filter(p => p.id !== id);
  writePasswords(passwords);
  res.json({ success: true });
});

// ========================
// FILE/PDF ROUTES
// ========================
app.post('/api/upload', authMiddleware, upload.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
  res.json({
    success: true,
    file: {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      uploadedAt: new Date().toISOString()
    }
  });
});

app.get('/api/files', authMiddleware, (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir).map(filename => {
      const stats = fs.statSync(path.join(uploadsDir, filename));
      return {
        filename,
        originalname: filename.replace(/^\d+-/, ''),
        size: stats.size,
        uploadedAt: stats.mtime.toISOString()
      };
    });
    res.json(files);
  } catch {
    res.json([]);
  }
});

app.get('/api/files/:filename', authMiddleware, (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado' });
  res.sendFile(filePath);
});

app.delete('/api/files/:filename', authMiddleware, (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado' });
  fs.unlinkSync(filePath);
  res.json({ success: true });
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
  const interfaces = os.networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
  }
  console.log('');
  console.log('===========================================');
  console.log('   SAPRO Dashboard Server');
  console.log('   CITIS Solutions');
  console.log('===========================================');
  console.log(`   Local:    http://localhost:${PORT}`);
  console.log(`   Red LAN:  http://${localIP}:${PORT}`);
  console.log('===========================================');
  console.log('');
  console.log('   Usuario: angel');
  console.log('   Clave:   angel');
  console.log('');
  console.log('   Presiona Ctrl+C para detener el servidor');
  console.log('');
});
