// ============================================================
// MÓDULO: Dashboard (contenedor principal de la aplicación)
// Descripción: Layout shell que contiene la barra de navegación
//   superior, el sidebar, y el área de contenido principal.
//   Renderiza el módulo activo según la vista seleccionada.
//
// Vistas disponibles (ActiveView):
//   overview      → DashboardOverview  (KPIs y gráficas)
//   passwords     → gestión interna (tablas inline)
//   files         → gestión de PDFs (tablas inline)
//   projects      → Proyects.tsx
//   commissions   → Commission.tsx
//   subscriptions → Subscriptions.tsx
//   clientes      → Clientes.tsx
//   ingresos      → Ingresos.tsx
//   gastos        → Gastos.tsx
//   catalogos     → Catalogos.tsx
//   reports       → Reports.tsx
//   users         → Users.tsx
//
// El token JWT se propaga a cada módulo hijo como prop.
// El tema (dark/light) se persiste en localStorage.
// ============================================================

import { useState, useEffect, useRef } from 'react'
import Projects from './Proyects.tsx'
import DashboardOverview from './DashboardOverview.tsx'
import Commission from './Commission.tsx'
import Subscriptions from './Subscriptions.tsx'
import Clientes from './Clientes.tsx'
import Ingresos from './Ingresos.tsx'
import Gastos from './Gastos.tsx'
import Users from './Users.tsx'
import Reports from './Reports.tsx'
import Catalogos from './Catalogos.tsx'

// ── Interfaces ──────────────────────────────────────────────

// Props del componente raíz
interface DashboardProps {
    token: string      // JWT de sesión del usuario autenticado
    user: string       // nombre de usuario para mostrar en el header
    onLogout: () => void
}

// Credencial almacenada en la vista "Contraseñas del Servidor"
interface PasswordEntry {
    id: string
    service: string
    username: string
    password: string
    createdAt: string
}

// Archivo PDF subido, asociado a un proyecto y tipo de documento
interface FileEntry {
    id: number
    filename: string       // nombre interno (UUID) en el servidor
    originalname: string   // nombre original del archivo
    size: number           // bytes
    uploadedAt: string
    proyecto: string       // nombre del proyecto (join)
    projectId: number
    tipoDocumento: string  // tipo de documento (join)
    descripcion: string
}

// Catálogo de tipos de documento (para el modal de subir PDF)
interface TipoDocumento {
    id: number
    nombre: string
}

// Unión de todas las vistas posibles del dashboard
type ActiveView = 'overview' | 'passwords' | 'files' | 'projects' | 'users' | 'commissions' | 'subscriptions' | 'reports' | 'clientes' | 'ingresos' | 'gastos' | 'catalogos'

// ── Definición de ítems del sidebar ─────────────────────────
// Cada ítem tiene: id (clave de vista), label (texto visible) e icon (SVG inline)
const NAV_ITEMS: { id: ActiveView; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Inicio', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg> },
    { id: 'passwords', label: 'Contraseñas', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg> },
    { id: 'files', label: 'Archivos PDF', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg> },
    { id: 'projects', label: 'Proyectos', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg> },
    { id: 'clientes', label: 'Clientes', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { id: 'ingresos', label: 'Ingresos', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
    { id: 'gastos', label: 'Gastos', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 6 10.5 15.5 15.5 10.5 23 18"/><polyline points="17 18 23 18 23 12"/></svg> },
    { id: 'catalogos', label: 'Catálogos', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
    { id: 'reports', label: 'Reportes', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 17H5a2 2 0 0 0-2 2"/><path d="M9 3H5a2 2 0 0 0-2 2v4"/><rect x="9" y="3" width="13" height="18" rx="2"/></svg> },
    { id: 'users', label: 'Usuarios', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
    { id: 'commissions', label: 'Comisiones', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> },
    { id: 'subscriptions', label: 'Suscripciones', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg> },
]

// ── Componente principal ─────────────────────────────────────
export default function Dashboard({ token, user, onLogout }: DashboardProps) {

    // ── Estado: navegación y layout ──────────────────────────
    const [activeView, setActiveView]   = useState<ActiveView>('overview')
    // Tema persistido en localStorage ('dark' por defecto)
    const [theme, setTheme]             = useState<'dark' | 'light'>(() => (localStorage.getItem('sapro_theme') as 'dark' | 'light') || 'dark')
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)   // sidebar colapsable con hamburger
    const [profileOpen, setProfileOpen] = useState(false)      // dropdown de perfil en el header
    const profileRef = useRef<HTMLDivElement>(null)             // ref para detectar clics fuera del dropdown

    // Aplica el tema al elemento <html> y lo persiste en localStorage
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('sapro_theme', theme)
    }, [theme])

    // Cierra el dropdown de perfil al hacer clic fuera de él
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])
    // ── Estado: contraseñas del servidor ─────────────────────
    const [passwords, setPasswords]         = useState<PasswordEntry[]>([])
    const [showAddPassword, setShowAddPassword] = useState(false)
    const [editingPassword, setEditingPassword] = useState<string | null>(null) // ID de la contraseña en edición
    const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set()) // IDs con contraseña visible

    // ── Estado: archivos PDF ──────────────────────────────────
    const [files, setFiles]                 = useState<FileEntry[]>([])
    const [uploading, setUploading]         = useState(false)
    const fileInputRef                      = useRef<HTMLInputElement>(null)
    const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([])
    const [projects, setProjects]           = useState<{ id: string; name: string }[]>([])
    const [filterProjectId, setFilterProjectId] = useState('') // filtro de archivos por proyecto

    // Modal para confirmar datos antes de subir el PDF
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [uploadNombre, setUploadNombre]   = useState('')
    const [uploadDescripcion, setUploadDescripcion] = useState('')
    const [uploadProjectId, setUploadProjectId] = useState('')
    const [uploadTipoId, setUploadTipoId]   = useState('')
    const [pendingFile, setPendingFile]     = useState<File | null>(null) // archivo seleccionado antes de confirmar

    // ── Estado: notificación global ───────────────────────────
    const [notification, setNotification]   = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

    // ── Formulario de contraseñas ─────────────────────────────
    const [formService, setFormService]   = useState('')
    const [formUsername, setFormUsername] = useState('')
    const [formPassword, setFormPassword] = useState('')

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }

    // ── Notificación temporal (3 segundos) ───────────────────
    const showNotif = (msg: string, type: 'success' | 'error' = 'success') => {
        setNotification({ msg, type })
        setTimeout(() => setNotification(null), 3000)
    }

    // Carga inicial: contraseñas y archivos al montar el layout
    useEffect(() => {
        fetchPasswords()
        fetchFiles()
    }, [])

    // Al entrar a la vista de archivos, carga catálogos y lista de archivos
    useEffect(() => {
        if (activeView === 'files') {
            fetchTiposDocumento()
            fetchProjectsList()
            fetchFiles(filterProjectId)
        }
    }, [activeView, filterProjectId])

    // ── Fetch: contraseñas del servidor ──────────────────────
    const fetchPasswords = async () => {
        try {
            const res = await fetch('/api/passwords', { headers })
            if (res.ok) setPasswords(await res.json())
        } catch { /* ignore */ }
    }

    // ── Fetch: archivos PDF (con filtro opcional por proyecto) ──
    const fetchFiles = async (projectId = '') => {
        try {
            const url = projectId ? `/api/files?projectId=${projectId}` : '/api/files'
            const res = await fetch(url, { headers })
            if (res.ok) setFiles(await res.json())
        } catch { /* ignore */ }
    }

    // ── Fetch: catálogo de tipos de documento (para modal PDF) ──
    const fetchTiposDocumento = async () => {
        try {
            const res = await fetch('/api/tipos-documento', { headers })
            if (res.ok) setTiposDocumento(await res.json())
        } catch { /* ignore */ }
    }

    // ── Fetch: lista de proyectos (para filtro y modal PDF) ──
    const fetchProjectsList = async () => {
        try {
            const res = await fetch('/api/projects', { headers })
            if (res.ok) {
                const data = await res.json()
                setProjects(data.map((p: { Pro_ID_Proyecto: string; Pro_Nombre: string }) => ({
                    id: p.Pro_ID_Proyecto,
                    name: p.Pro_Nombre
                })))
            }
        } catch { /* ignore */ }
    }

    // ── CRUD: Contraseñas ─────────────────────────────────────
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

    // ── Operaciones: Archivos PDF ─────────────────────────────
    // Al seleccionar un archivo, abre el modal para completar metadata antes de subir
    const openUploadModal = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setPendingFile(file)
        setUploadNombre(file.name.replace(/\.pdf$/i, ''))
        setUploadDescripcion('')
        setUploadProjectId('')
        setUploadTipoId('')
        setShowUploadModal(true)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    // Envía el PDF al servidor con FormData (multipart); usa token sin Content-Type para que el browser lo establezca con boundary
    const submitUpload = async () => {
        if (!pendingFile || !uploadProjectId || !uploadTipoId) {
            showNotif('Proyecto y tipo de documento son requeridos', 'error')
            return
        }
        setUploading(true)
        const formData = new FormData()
        formData.append('pdf', pendingFile)
        formData.append('projectId', uploadProjectId)
        formData.append('tipoDocumentoId', uploadTipoId)
        formData.append('nombre', uploadNombre)
        formData.append('descripcion', uploadDescripcion)
        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            })
            if (res.ok) {
                await fetchFiles(filterProjectId)
                setShowUploadModal(false)
                setPendingFile(null)
                showNotif('PDF subido exitosamente')
            } else {
                const data = await res.json()
                showNotif(data.error || 'Error al subir', 'error')
            }
        } catch {
            showNotif('Error al subir archivo', 'error')
        } finally {
            setUploading(false)
        }
    }

    const cancelUpload = () => {
        setShowUploadModal(false)
        setPendingFile(null)
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

    // Abre el PDF en una nueva pestaña; el token se pasa como query param para autenticar
    const viewFile = (filename: string) => {
        window.open(`/api/files/${filename}?token=${token}`, '_blank')
    }

    // Formatea bytes a B / KB / MB para mostrar en la UI
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

    // ── Render ───────────────────────────────────────────────
    // Estructura: header (top-nav) + aside (sidebar) + main (content-area)
    return (
        <div className="dashboard">
            {/* ── Barra superior: hamburger + marca + tema + perfil ── */}
            <header className="top-nav">
                <div className="nav-left">
                    <button className="hamburger-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)} title="Toggle Menu">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>
                    <div className="nav-brand">
                        <span>SAPRO</span>
                    </div>
                </div>

                <div className="nav-right" ref={profileRef}>
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

            {/* ── Sidebar: lista de módulos del sistema ── */}
            <aside className={`sidebar ${!isSidebarOpen ? 'closed' : ''}`}>
                {NAV_ITEMS.map(({ id, label, icon }) => (
                    <div
                        key={id}
                        className={`sidebar-item ${activeView === id ? 'active' : ''}`}
                        onClick={() => setActiveView(id)}
                    >
                        <div className="sidebar-item-left">
                            {icon}
                            <span>{label}</span>
                        </div>
                        {id === 'passwords' && <span className="sidebar-badge">{passwords.length}</span>}
                        {id === 'files' && <span className="sidebar-badge">{files.length}</span>}
                    </div>
                ))}
            </aside>

            {/* ── Área principal de contenido ── */}
            {/* La clase 'expanded' amplía el área cuando el sidebar está cerrado */}
            <main className={`main-content ${!isSidebarOpen ? 'expanded' : ''}`}>
                {/* Encabezado contextual: título y subtítulo según la vista activa */}
                <header className="top-bar">
                    <div>
                        <h1>
                            {activeView === 'overview' && '📊 Resumen General'}
                            {activeView === 'commissions' && '💰 Gestión de Comisiones'}
                            {activeView === 'passwords' && '🔐 Contraseñas del Servidor'}
                            {activeView === 'files' && '📄 Archivos PDF'}
                            {activeView === 'projects' && '🚀 Gestión de Proyectos'}
                            {activeView === 'subscriptions' && '🧾 Gestión de Suscripciones'}
                            {activeView === 'clientes' && '🏢 Clientes'}
                            {activeView === 'ingresos' && '📈 Ingresos'}
                            {activeView === 'gastos' && '💸 Gastos'}
                            {activeView === 'users' && '👤 Usuarios'}
                            {activeView === 'catalogos' && '🗂️ Catálogos'}
                            {activeView === 'reports' && '📋 Reportes'}
                        </h1>
                        <p className="subtitle">
                            {activeView === 'overview' && 'Vista rápida del estado de la empresa'}
                            {activeView === 'commissions' && 'Administra y valida los pagos de comisiones'}
                            {activeView === 'passwords' && `${passwords.length} contraseña${passwords.length !== 1 ? 's' : ''} almacenada${passwords.length !== 1 ? 's' : ''}`}
                            {activeView === 'files' && `${files.length} archivo${files.length !== 1 ? 's' : ''} almacenado${files.length !== 1 ? 's' : ''}`}
                            {activeView === 'projects' && 'Gestiona y rastrea el trabajo de tu equipo'}
                            {activeView === 'subscriptions' && 'Administra planes, renovaciones y estatus'}
                            {activeView === 'clientes' && 'Registra y administra los clientes de la empresa'}
                            {activeView === 'ingresos' && 'Registra y consulta los pagos recibidos por proyecto'}
                            {activeView === 'gastos' && 'Registra y controla los gastos y egresos de la empresa'}
                            {activeView === 'users' && 'Administra los usuarios y sus accesos al sistema'}
                            {activeView === 'catalogos' && 'Administra los catálogos y listas del sistema'}
                            {activeView === 'reports' && 'Análisis financiero y operativo de la empresa'}
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
                                onChange={openUploadModal}
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

                {/* ── Vista: Contraseñas del Servidor ── */}
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

                {/* ── Vista: Archivos PDF ── */}
                {activeView === 'files' && (
                    <div className="content-area">
                        {/* Upload Modal */}
                        {showUploadModal && (
                            <div className="modal-overlay" onClick={cancelUpload}>
                                <div className="modal-card fade-in" onClick={e => e.stopPropagation()}>
                                    <h3>Subir Documento PDF</h3>
                                    <div className="form-grid">
                                        <div className="input-group">
                                            <label>Nombre del documento</label>
                                            <input
                                                type="text"
                                                value={uploadNombre}
                                                onChange={e => setUploadNombre(e.target.value)}
                                                placeholder="ej. Contrato de servicio..."
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Proyecto <span style={{ color: 'var(--accent)' }}>*</span></label>
                                            <select value={uploadProjectId} onChange={e => setUploadProjectId(e.target.value)}>
                                                <option value="">— Selecciona un proyecto —</option>
                                                {projects.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="input-group">
                                            <label>Tipo de documento <span style={{ color: 'var(--accent)' }}>*</span></label>
                                            <select value={uploadTipoId} onChange={e => setUploadTipoId(e.target.value)}>
                                                <option value="">— Selecciona un tipo —</option>
                                                {tiposDocumento.map(t => (
                                                    <option key={t.id} value={t.id}>{t.nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="input-group">
                                            <label>Descripción <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>(opcional)</span></label>
                                            <input
                                                type="text"
                                                value={uploadDescripcion}
                                                onChange={e => setUploadDescripcion(e.target.value)}
                                                placeholder="Breve descripción del archivo..."
                                            />
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                                        Archivo: <strong>{pendingFile?.name}</strong>
                                    </p>
                                    <div className="form-actions">
                                        <button className="action-btn secondary" onClick={cancelUpload}>Cancelar</button>
                                        <button className="action-btn primary" onClick={submitUpload} disabled={uploading}>
                                            {uploading ? 'Subiendo...' : 'Confirmar y Subir'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Project filter */}
                        {projects.length > 0 && (
                            <div className="files-filter">
                                <select
                                    value={filterProjectId}
                                    onChange={e => setFilterProjectId(e.target.value)}
                                    className="filter-select"
                                >
                                    <option value="">Todos los proyectos</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

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
                                            {file.proyecto && (
                                                <div className="file-tags">
                                                    <span className="file-tag project-tag">{file.proyecto}</span>
                                                    {file.tipoDocumento && <span className="file-tag tipo-tag">{file.tipoDocumento}</span>}
                                                </div>
                                            )}
                                            {file.descripcion && (
                                                <p className="file-descripcion">{file.descripcion}</p>
                                            )}
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
                {/* ── Vista: Proyectos ── */}
                {activeView === 'projects' && (
                    <div className="content-area">
                        <Projects token={token} />
                    </div>
                )}

                {/* ── Vista: Dashboard Overview (KPIs y gráficas) ── */}
                {activeView === 'overview' && (
                    <div className="content-area">
                        <DashboardOverview token={token} />
                    </div>
                )}

                {/* ── Vista: Comisiones ── */}
                {activeView === 'commissions' && (
                    <div className="content-area">
                        <Commission token={token} />
                    </div>
                )}

                {/* ── Vista: Suscripciones ── */}
                {activeView === 'subscriptions' && (
                    <div className="content-area">
                        <Subscriptions token={token} />
                    </div>
                )}

                {/* ── Vista: Clientes ── */}
                {activeView === 'clientes' && (
                    <div className="content-area">
                        <Clientes token={token} />
                    </div>
                )}

                {/* ── Vista: Ingresos ── */}
                {activeView === 'ingresos' && (
                    <div className="content-area">
                        <Ingresos token={token} />
                    </div>
                )}

                {/* ── Vista: Gastos ── */}
                {activeView === 'gastos' && (
                    <div className="content-area">
                        <Gastos token={token} />
                    </div>
                )}

                {/* ── Vista: Catálogos ── */}
                {activeView === 'catalogos' && (
                    <div className="content-area">
                        <Catalogos token={token} />
                    </div>
                )}

                {/* ── Vista: Reportes ── */}
                {activeView === 'reports' && (
                    <div className="content-area">
                        <Reports token={token} />
                    </div>
                )}

                {/* ── Vista: Usuarios ── */}
                {activeView === 'users' && (
                    <div className="content-area">
                        <Users token={token} />
                    </div>
                )}
            </main>
        </div>
    )
}
