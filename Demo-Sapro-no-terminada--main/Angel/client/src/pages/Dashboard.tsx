import { useState, useEffect, useRef } from 'react'
import Projects from './Proyects.tsx'
import DashboardOverview from './DashboardOverview.tsx'
import Commission from './Commission.tsx'

interface DashboardProps {
    token: string
    user: string
    onLogout: () => void
}

interface Proyect {
    id: string
    name: string
    description: string
    createdAt: string
}

interface PasswordEntry {
    id: string
    service: string
    username: string
    password: string
    createdAt: string
}

interface FileEntry {
    filename: string
    originalname: string
    size: number
    uploadedAt: string
}

type ActiveView = 'overview' | 'passwords' | 'files' | 'projects' | 'users' | 'commissions' | 'reports'

const NAV_ITEMS: { id: ActiveView; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Inicio', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg> },
    { id: 'passwords', label: 'Contraseñas', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg> },
    { id: 'files', label: 'Archivos PDF', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg> },
    { id: 'projects', label: 'Proyectos', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg> },
    { id: 'commissions', label: 'Comisiones', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> },
]

export default function Dashboard({ token, user, onLogout }: DashboardProps) {
    const [activeView, setActiveView] = useState<ActiveView>('overview')
    const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('sapro_theme') as 'dark' | 'light') || 'dark')
    const [menuOpen, setMenuOpen] = useState(false)
    const [profileOpen, setProfileOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const profileRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('sapro_theme', theme)
    }, [theme])

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])
    const [passwords, setPasswords] = useState<PasswordEntry[]>([])
    const [files, setFiles] = useState<FileEntry[]>([])
    const [showAddPassword, setShowAddPassword] = useState(false)
    const [editingPassword, setEditingPassword] = useState<string | null>(null)
    const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set())
    const [uploading, setUploading] = useState(false)
    const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Form state
    const [formService, setFormService] = useState('')
    const [formUsername, setFormUsername] = useState('')
    const [formPassword, setFormPassword] = useState('')

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }

    const showNotif = (msg: string, type: 'success' | 'error' = 'success') => {
        setNotification({ msg, type })
        setTimeout(() => setNotification(null), 3000)
    }

    // Fetch data
    useEffect(() => {
        fetchPasswords()
        fetchFiles()
    }, [])

    const fetchPasswords = async () => {
        try {
            const res = await fetch('/api/passwords', { headers })
            if (res.ok) setPasswords(await res.json())
        } catch { /* ignore */ }
    }

    const fetchFiles = async () => {
        try {
            const res = await fetch('/api/files', { headers })
            if (res.ok) setFiles(await res.json())
        } catch { /* ignore */ }
    }

    // Password CRUD
    const addPassword = async () => {
        if (!formService || !formUsername || !formPassword) return
        try {
            const res = await fetch('/api/passwords', {
                method: 'POST',
                headers,
                body: JSON.stringify({ service: formService, username: formUsername, password: formPassword })
            })
            if (res.ok) {
                await fetchPasswords()
                resetForm()
                showNotif('Contraseña agregada exitosamente')
            }
        } catch {
            showNotif('Error al agregar', 'error')
        }
    }

    const updatePassword = async (id: string) => {
        try {
            const res = await fetch(`/api/passwords/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ service: formService, username: formUsername, password: formPassword })
            })
            if (res.ok) {
                await fetchPasswords()
                resetForm()
                setEditingPassword(null)
                showNotif('Contraseña actualizada')
            }
        } catch {
            showNotif('Error al actualizar', 'error')
        }
    }

    const deletePassword = async (id: string) => {
        try {
            await fetch(`/api/passwords/${id}`, { method: 'DELETE', headers })
            await fetchPasswords()
            showNotif('Contraseña eliminada')
        } catch {
            showNotif('Error al eliminar', 'error')
        }
    }

    const startEdit = (pw: PasswordEntry) => {
        setEditingPassword(pw.id)
        setFormService(pw.service)
        setFormUsername(pw.username)
        setFormPassword(pw.password)
        setShowAddPassword(true)
    }

    const resetForm = () => {
        setFormService('')
        setFormUsername('')
        setFormPassword('')
        setShowAddPassword(false)
        setEditingPassword(null)
    }

    const togglePasswordVisibility = (id: string) => {
        setVisiblePasswords(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    // File operations
    const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        const formData = new FormData()
        formData.append('pdf', file)
        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            })
            if (res.ok) {
                await fetchFiles()
                showNotif('PDF subido exitosamente')
            } else {
                const data = await res.json()
                showNotif(data.error || 'Error al subir', 'error')
            }
        } catch {
            showNotif('Error al subir archivo', 'error')
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const deleteFile = async (filename: string) => {
        try {
            await fetch(`/api/files/${filename}`, { method: 'DELETE', headers })
            await fetchFiles()
            showNotif('Archivo eliminado')
        } catch {
            showNotif('Error al eliminar', 'error')
        }
    }

    const viewFile = (filename: string) => {
        window.open(`/api/files/${filename}?token=${token}`, '_blank')
    }

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / 1048576).toFixed(1) + ' MB'
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('es-ES', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        })
    }

    return (
        <div className="dashboard">
            {/* Top Navigation */}
            <header className="top-nav">
                <div className="nav-left">
                    <button
                        type="button"
                        className="nav-theme-btn"
                        onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                        title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                    >
                        {theme === 'dark' ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                        )}
                    </button>
                    <div className="nav-menu-wrapper" ref={menuRef}>
                        <button type="button" className="nav-menu-trigger" onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                            Menú
                        </button>
                        {menuOpen && (
                            <div className="nav-menu-dropdown">
                                {NAV_ITEMS.map(({ id, label, icon }) => (
                                    <button
                                        key={id}
                                        type="button"
                                        className={`nav-dropdown-item ${activeView === id ? 'active' : ''}`}
                                        onClick={() => { setActiveView(id); setMenuOpen(false) }}
                                    >
                                        {icon}
                                        {label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="nav-center">
                    <div className="nav-brand">
                        <div className="nav-brand-logo" aria-hidden>Logo</div>
                        <span>SAPRO</span>
                    </div>
                </div>

                <div className="nav-right" ref={profileRef}>
                    <button type="button" className="nav-profile-trigger" onClick={() => setProfileOpen(o => !o)} aria-expanded={profileOpen}>
                        <div className="user-avatar">{user.charAt(0).toUpperCase()}</div>
                        <span className="user-name">{user}</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 4, opacity: profileOpen ? 1 : 0.7 }}>
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                    {profileOpen && (
                        <div className="nav-profile-dropdown">
                            <div className="profile-info">
                                <div className="user-avatar">{user.charAt(0).toUpperCase()}</div>
                                <div className="user-name">{user}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user.toLowerCase().replace(/\s/g, '')}@cits.local</div>
                            </div>
                            <button type="button" className="profile-logout" onClick={() => { setProfileOpen(false); onLogout() }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                                Cerrar sesión
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Main content */}
            <main className="main-content">
                {/* Top bar */}
                <header className="top-bar">
                    <div>
                        <h1>
                            {activeView === 'overview' && '📊 Resumen General'}
                            {activeView === 'commissions' && '💰 Gestión de Comisiones'}
                            {activeView === 'passwords' && '🔐 Contraseñas del Servidor'}
                            {activeView === 'files' && '📄 Archivos PDF'}
                            {activeView === 'projects' && '🚀 Gestión de Proyectos'}
                        </h1>
                        <p className="subtitle">
                            {activeView === 'overview' && 'Vista rápida del estado de la empresa'}
                            {activeView === 'commissions' && 'Administra y valida los pagos de comisiones'}
                            {activeView === 'passwords' && `${passwords.length} contraseña${passwords.length !== 1 ? 's' : ''} almacenada${passwords.length !== 1 ? 's' : ''}`}
                            {activeView === 'files' && `${files.length} archivo${files.length !== 1 ? 's' : ''} almacenado${files.length !== 1 ? 's' : ''}`}
                            {activeView === 'projects' && 'Gestiona y rastrea el trabajo de tu equipo'}
                        </p>
                    </div>
                    {activeView === 'passwords' && (
                        <button className="action-btn primary" onClick={() => { resetForm(); setShowAddPassword(true) }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Nueva Contraseña
                        </button>
                    )}
                    {activeView === 'files' && (
                        <label className="action-btn primary upload-label">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            {uploading ? 'Subiendo...' : 'Subir PDF'}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf"
                                onChange={uploadFile}
                                style={{ display: 'none' }}
                                disabled={uploading}
                            />
                        </label>
                    )}
                </header>

                {/* Notification */}
                {notification && (
                    <div className={`notification ${notification.type}`}>
                        {notification.type === 'success' ? '✅' : '❌'} {notification.msg}
                    </div>
                )}

                {/* Passwords View */}
                {activeView === 'passwords' && (
                    <div className="content-area">
                        {/* Add/Edit form */}
                        {showAddPassword && (
                            <div className="form-card fade-in">
                                <h3>{editingPassword ? 'Editar Contraseña' : 'Nueva Contraseña'}</h3>
                                <div className="form-grid">
                                    <div className="input-group">
                                        <label>Servicio</label>
                                        <input
                                            type="text"
                                            value={formService}
                                            onChange={(e) => setFormService(e.target.value)}
                                            placeholder="ej. MySQL, SSH, FTP..."
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Usuario</label>
                                        <input
                                            type="text"
                                            value={formUsername}
                                            onChange={(e) => setFormUsername(e.target.value)}
                                            placeholder="ej. root, admin..."
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Contraseña</label>
                                        <input
                                            type="text"
                                            value={formPassword}
                                            onChange={(e) => setFormPassword(e.target.value)}
                                            placeholder="Contraseña del servicio"
                                        />
                                    </div>
                                </div>
                                <div className="form-actions">
                                    <button className="action-btn secondary" onClick={resetForm}>Cancelar</button>
                                    <button
                                        className="action-btn primary"
                                        onClick={() => editingPassword ? updatePassword(editingPassword) : addPassword()}
                                    >
                                        {editingPassword ? 'Guardar Cambios' : 'Agregar'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Password table */}
                        {passwords.length === 0 ? (
                            <div className="empty-state">
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                <h3>No hay contraseñas guardadas</h3>
                                <p>Haz clic en "Nueva Contraseña" para agregar una</p>
                            </div>
                        ) : (
                            <div className="table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Servicio</th>
                                            <th>Usuario</th>
                                            <th>Contraseña</th>
                                            <th>Fecha</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {passwords.map(pw => (
                                            <tr key={pw.id} className="fade-in">
                                                <td>
                                                    <div className="service-cell">
                                                        <div className="service-icon">
                                                            {pw.service.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span>{pw.service}</span>
                                                    </div>
                                                </td>
                                                <td><code>{pw.username}</code></td>
                                                <td>
                                                    <div className="password-cell">
                                                        <code>{visiblePasswords.has(pw.id) ? pw.password : '••••••••'}</code>
                                                        <button
                                                            className="icon-btn"
                                                            onClick={() => togglePasswordVisibility(pw.id)}
                                                            title={visiblePasswords.has(pw.id) ? 'Ocultar' : 'Mostrar'}
                                                        >
                                                            {visiblePasswords.has(pw.id) ? (
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                                    <line x1="1" y1="1" x2="23" y2="23" />
                                                                </svg>
                                                            ) : (
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                                    <circle cx="12" cy="12" r="3" />
                                                                </svg>
                                                            )}
                                                            <span className="btn-label">Ver</span>
                                                        </button>
                                                        <button
                                                            className="icon-btn"
                                                            onClick={() => { navigator.clipboard.writeText(pw.password); showNotif('Copiada al portapapeles') }}
                                                            title="Copiar"
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                            </svg>
                                                            <span className="btn-label">Copiar</span>
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="date-cell">{formatDate(pw.createdAt)}</td>
                                                <td>
                                                    <div className="action-cell">
                                                        <button className="icon-btn edit" onClick={() => startEdit(pw)} title="Editar">
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                            </svg>
                                                            <span className="btn-label">Editar</span>
                                                        </button>
                                                        <button className="icon-btn delete" onClick={() => deletePassword(pw.id)} title="Eliminar">
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <polyline points="3 6 5 6 21 6" />
                                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                            </svg>
                                                            <span className="btn-label">Borrar</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Files View */}
                {activeView === 'files' && (
                    <div className="content-area">
                        {files.length === 0 ? (
                            <div className="empty-state">
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                                <h3>No hay archivos PDF</h3>
                                <p>Haz clic en "Subir PDF" para agregar uno</p>
                            </div>
                        ) : (
                            <div className="files-grid">
                                {files.map(file => (
                                    <div key={file.filename} className="file-card fade-in">
                                        <div className="file-icon">
                                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                <polyline points="14 2 14 8 20 8" />
                                            </svg>
                                            <span className="file-badge">PDF</span>
                                        </div>
                                        <div className="file-info">
                                            <h4 title={file.originalname}>{file.originalname}</h4>
                                            <div className="file-meta">
                                                <span>{formatBytes(file.size)}</span>
                                                <span>•</span>
                                                <span>{formatDate(file.uploadedAt)}</span>
                                            </div>
                                        </div>
                                        <div className="file-actions">
                                            <button className="icon-btn view" onClick={() => viewFile(file.filename)} title="Ver PDF">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                    <circle cx="12" cy="12" r="3" />
                                                </svg>
                                                <span className="btn-label">Ver</span>
                                            </button>
                                            <button className="icon-btn delete" onClick={() => deleteFile(file.filename)} title="Eliminar">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                                <span className="btn-label">Borrar</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                {/* Projects View */}
                {activeView === 'projects' && (
                    <div className="content-area">
                        <Projects token={token} />
                    </div>
                )}

                {/* Overview View */}
                {activeView === 'overview' && (
                    <div className="content-area">
                        <DashboardOverview />
                    </div>
                )}

                {/* Commission View */}
                {activeView === 'commissions' && (
                    <div className="content-area">
                        <Commission token={token} />
                    </div>
                )}
            </main>
        </div>
    )
}
