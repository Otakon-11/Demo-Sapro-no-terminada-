// ============================================================
// MÓDULO: Clientes
// Descripción: Gestión de clientes del sistema (alta, edición,
//   activar/desactivar). Soporta búsqueda por nombre, RFC o correo.
// Rutas API utilizadas:
//   GET    /api/clientes?search=...  → listar / buscar clientes
//   POST   /api/clientes             → crear cliente
//   PUT    /api/clientes/:id         → editar cliente
//   PATCH  /api/clientes/:id/estatus → activar/desactivar cliente
//   GET    /api/tipos-cliente        → catálogo de categorías
//   GET    /api/direcciones          → catálogo de direcciones
// ============================================================

import { useState, useEffect } from 'react'

// ── Interfaces ──────────────────────────────────────────────

// Representa un cliente tal como llega del servidor
interface Cliente {
  id: number
  nombre: string
  tipo: string             // tipo libre (ej. "Empresa", "Hospital")
  rfc: string | null
  telefono: string
  correo: string
  contactoNombre: string | null
  contactoPuesto: string | null
  fechaRegistro: string
  estatus: boolean         // true = activo, false = inactivo
  tipoCliente: string | null   // nombre de la categoría (join)
  tipoClienteId: number | null // FK a catálogo de tipos
  direccionId: number | null   // FK a catálogo de direcciones
  direccion: string | null     // descripción de la dirección (join)
}

// Catálogo de tipos/categorías de cliente
interface TipoCliente {
  id: number
  nombre: string
}

// Catálogo de direcciones registradas en el sistema
interface Direccion {
  id: number
  descripcion: string
}

// Props que recibe el componente desde el layout padre
interface ClientesProps {
  token: string // JWT para autenticación en cada llamada API
}

// ── Formulario vacío (valores por defecto al crear) ──────────
const emptyForm = {
  nombre: '', tipo: '', rfc: '', telefono: '', correo: '',
  contactoNombre: '', contactoPuesto: '', tipoClienteId: '', direccionId: '' ,
}

// ── Componente principal ─────────────────────────────────────
export default function Clientes({ token }: ClientesProps) {

  // ── Estado: datos ────────────────────────────────────────
  const [clientes, setClientes]     = useState<Cliente[]>([])
  const [tipos, setTipos]           = useState<TipoCliente[]>([])   // catálogo de categorías
  const [direcciones, setDirecciones] = useState<Direccion[]>([])   // catálogo de direcciones

  // ── Estado: UI ───────────────────────────────────────────
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')          // texto de búsqueda
  const [showModal, setShowModal]   = useState(false)       // visibilidad del modal
  const [editing, setEditing]       = useState<Cliente | null>(null) // null = crear, Cliente = editar
  const [form, setForm]             = useState(emptyForm)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [notif, setNotif]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Encabezados HTTP reutilizados en todas las peticiones
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // ── Notificación temporal (3 segundos) ───────────────────
  const showNotif = (msg: string, type: 'success' | 'error' = 'success') => {
    setNotif({ msg, type })
    setTimeout(() => setNotif(null), 3000)
  }

  // ── Fetch: lista de clientes (con búsqueda opcional) ─────
  const fetchClientes = async (q = '') => {
    try {
      // Si hay query, se pasa como parámetro; si no, trae todos
      const url = q ? `/api/clientes?search=${encodeURIComponent(q)}` : '/api/clientes'
      const res = await fetch(url, { headers })
      if (res.ok) setClientes(await res.json())
    } catch { /* error de red — se ignora silenciosamente */ }
    finally { setLoading(false) }
  }

  // ── Fetch: catálogo de tipos de cliente ──────────────────
  const fetchTipos = async () => {
    try {
      const res = await fetch('/api/tipos-cliente', { headers })
      if (res.ok) setTipos(await res.json())
    } catch { /* ignore */ }
  }

  // ── Fetch: catálogo de direcciones ───────────────────────
  const fetchDirecciones = async () => {
    try {
      const res = await fetch('/api/direcciones', { headers })
      if (res.ok) setDirecciones(await res.json())
    } catch { /* ignore */ }
  }

  // Carga inicial de datos al montar el componente
  useEffect(() => { fetchClientes(); fetchTipos(); fetchDirecciones() }, [])

  // ── Búsqueda al presionar Enter o botón ──────────────────
  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    fetchClientes(search)
  }

  // ── Abrir modal en modo CREAR ─────────────────────────────
  const openAdd = () => {
    setEditing(null)       // sin cliente = modo creación
    setForm(emptyForm)
    setError('')
    setShowModal(true)
  }

  // ── Abrir modal en modo EDITAR (pre-carga datos del cliente) ─
  const openEdit = (c: Cliente) => {
    setEditing(c)          // guarda referencia del cliente a editar
    setForm({
      nombre: c.nombre, tipo: c.tipo, rfc: c.rfc || '', telefono: c.telefono,
      correo: c.correo, contactoNombre: c.contactoNombre || '',
      contactoPuesto: c.contactoPuesto || '',
      tipoClienteId: c.tipoClienteId?.toString() || '',
      direccionId:   c.direccionId?.toString()   || ''
    })
    setError('')
    setShowModal(true)
  }

  // ── Guardar cliente (crear o editar según `editing`) ─────
  const handleSave = async () => {
    // Validación de campos requeridos
    if (!form.nombre.trim() || !form.tipo.trim() || !form.telefono.trim() || !form.correo.trim()) {
      setError('Nombre, tipo, teléfono y correo son requeridos')
      return
    }
    setSaving(true); setError('')

    // Construir body con tipos correctos (null en lugar de string vacío)
    const body = {
      nombre:         form.nombre.trim(),
      tipo:           form.tipo.trim(),
      rfc:            form.rfc.trim() || null,           // null si no se proporcionó
      telefono:       form.telefono.trim(),
      correo:         form.correo.trim(),
      contactoNombre: form.contactoNombre.trim() || null,
      contactoPuesto: form.contactoPuesto.trim() || null,
      tipoClienteId:  form.tipoClienteId ? Number(form.tipoClienteId) : null, // FK numérica
      direccionId:    form.direccionId   ? Number(form.direccionId)   : null  // FK numérica
    }

    try {
      // PUT si editando, POST si creando
      const url    = editing ? `/api/clientes/${editing.id}` : '/api/clientes'
      const method = editing ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers, body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }

      await fetchClientes(search)   // refresca la tabla
      setShowModal(false)
      showNotif(editing ? 'Cliente actualizado' : 'Cliente registrado')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setSaving(false) }
  }

  // ── Activar / Desactivar cliente (PATCH optimista) ───────
  const toggleEstatus = async (c: Cliente) => {
    try {
      const res = await fetch(`/api/clientes/${c.id}/estatus`, { method: 'PATCH', headers })
      if (res.ok) {
        const { estatus } = await res.json()
        // Actualiza solo ese cliente en la lista local sin recargar todo
        setClientes(prev => prev.map(x => x.id === c.id ? { ...x, estatus } : x))
        showNotif(estatus ? 'Cliente activado' : 'Cliente desactivado')
      }
    } catch { showNotif('Error al cambiar estatus', 'error') }
  }

  // Formatea fecha ISO a "DD MMM AAAA" en español
  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  // ── Helper: renderiza un campo de texto del formulario ───
  // Reduce repetición en el modal; usa `key` como prop del form state
  const field = (
    key: keyof typeof form,
    label: string,
    opts?: { type?: string; placeholder?: string; required?: boolean; maxLength?: number }
  ) => (
    <div className="form-group">
      <label>{label}{opts?.required && <span style={{ color: 'var(--error)' }}> *</span>}</label>
      <input
        className="modal-input"
        type={opts?.type || 'text'}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={opts?.placeholder || ''}
        maxLength={opts?.maxLength}
      />
    </div>
  )

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="clientes-page fade-in">

      {/* ── Notificación flotante (éxito o error) ── */}
      {notif && (
        <div className={`notification ${notif.type}`}>
          {notif.type === 'success' ? '✅' : '❌'} {notif.msg}
        </div>
      )}

      {/* ── Barra de herramientas: búsqueda + botón Nuevo ── */}
      <div className="clientes-toolbar">
        <form className="search-form" onSubmit={handleSearch}>
          <div className="search-input-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="search-input"
              placeholder="Buscar por nombre, RFC o correo..."
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                // Si se borra el campo, vuelve a cargar todos los clientes
                if (!e.target.value) fetchClientes()
              }}
            />
          </div>
          <button type="submit" className="action-btn secondary">Buscar</button>
        </form>
        <button type="button" className="action-btn primary" onClick={openAdd}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo Cliente
        </button>
      </div>

      {/* ── Tabla de clientes ── */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando clientes...</div>
      ) : clientes.length === 0 ? (
        // Estado vacío
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h3>No hay clientes registrados</h3>
          <p>Haz clic en "Nuevo Cliente" para agregar uno</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>RFC</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Dirección</th>
                <th>Contacto</th>
                <th>Registro</th>
                <th>Estatus</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map(c => (
                // Filas inactivas se ven atenuadas (row-inactive aplica opacity)
                <tr key={c.id} className={`fade-in${!c.estatus ? ' row-inactive' : ''}`}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.nombre}</div>
                    {/* Muestra la categoría del catálogo si existe */}
                    {c.tipoCliente && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.tipoCliente}</div>}
                  </td>
                  <td>{c.tipo}</td>
                  <td><code style={{ fontSize: '0.8rem' }}>{c.rfc || '—'}</code></td>
                  <td>{c.telefono}</td>
                  <td style={{ fontSize: '0.85rem' }}>{c.correo}</td>
                  {/* Dirección truncada si es muy larga */}
                  <td style={{ fontSize: '0.8rem', maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.direccion || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td>
                    {c.contactoNombre
                      ? <><div>{c.contactoNombre}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.contactoPuesto}</div></>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="date-cell">{formatDate(c.fechaRegistro)}</td>
                  <td>
                    <span className={`status-badge ${c.estatus ? 'badge-active' : 'badge-inactive'}`}>
                      {c.estatus ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="action-cell">
                      {/* Botón editar */}
                      <button className="icon-btn edit" onClick={() => openEdit(c)} title="Editar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span className="btn-label">Editar</span>
                      </button>

                      {/* Botón activar/desactivar (alterna entre rojo y verde) */}
                      <button
                        className={`icon-btn ${c.estatus ? 'delete' : 'view'}`}
                        onClick={() => toggleEstatus(c)}
                        title={c.estatus ? 'Desactivar' : 'Activar'}
                      >
                        {c.estatus ? (
                          // Ícono de desactivar (círculo con X)
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                          </svg>
                        ) : (
                          // Ícono de activar (paloma / checkmark)
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        <span className="btn-label">{c.estatus ? 'Desactivar' : 'Activar'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Crear / Editar cliente ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-card fade-in" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h3>{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
            {error && <div style={{ color: 'var(--error)', marginBottom: 12, fontSize: '0.875rem' }}>{error}</div>}

            <div className="form-grid">
              {/* Campos de texto simples */}
              {field('nombre', 'Nombre / Razón social', { required: true, placeholder: 'ej. Hospital Obregón' })}

              {/* Selector de categoría desde catálogo de tipos */}
              <div className="form-group">
                <label>Categoría</label>
                <select
                  className="modal-input"
                  value={form.tipoClienteId}
                  onChange={e => setForm(f => ({ ...f, tipoClienteId: e.target.value }))}
                >
                  <option value="">— Sin categoría —</option>
                  {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>

              {field('tipo', 'Tipo (libre)', { required: true, placeholder: 'ej. Empresa, Hospital, Gobierno...' })}
              {field('rfc', 'RFC', { placeholder: 'ej. ABC123456XYZ', maxLength: 13 })}
              {field('telefono', 'Teléfono', { required: true, placeholder: 'ej. 6441234567', maxLength: 20 })}
              {field('correo', 'Correo', { type: 'email', required: true, placeholder: 'contacto@empresa.mx', maxLength: 100 })}
              {field('contactoNombre', 'Nombre del contacto', { placeholder: 'ej. Juan Pérez', maxLength: 150 })}
              {field('contactoPuesto', 'Puesto del contacto', { placeholder: 'ej. Gerente TI', maxLength: 100 })}

              {/* Selector de dirección desde catálogo de direcciones */}
              <div className="form-group">
                <label>Dirección</label>
                <select
                  className="modal-input"
                  value={form.direccionId}
                  onChange={e => setForm(f => ({ ...f, direccionId: e.target.value }))}
                >
                  <option value="">— Sin dirección —</option>
                  {direcciones.map(d => <option key={d.id} value={d.id}>{d.descripcion}</option>)}
                </select>
              </div>
            </div>

            {/* Botones de acción del modal */}
            <div className="modal-actions" style={{ marginTop: 20, display: 'flex', gap: 12 }}>
              <button className="action-btn primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Registrar cliente'}
              </button>
              <button className="action-btn secondary" onClick={() => !saving && setShowModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Estilos locales del módulo ── */}
      <style>{`
        .clientes-page .data-table { min-width: 900px; }
        .clientes-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
        .search-form { display: flex; gap: 8px; align-items: center; flex: 1; max-width: 480px; }
        .search-input-wrap { position: relative; flex: 1; }
        .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
        .search-input { width: 100%; padding: 8px 12px 8px 34px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius); color: var(--text-primary); font-size: 0.875rem; }
        .search-input:focus { outline: none; border-color: var(--accent-primary); }
        .row-inactive td { opacity: 0.5; }
        .status-badge { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
        .badge-active { background: rgba(255,255,255,0.08); color: var(--text-primary); border: 1px solid var(--border-color); }
        .badge-inactive { background: rgba(255,68,68,0.1); color: var(--error); border: 1px solid rgba(255,68,68,0.3); }
        [data-theme="light"] .badge-active { background: rgba(37,99,235,0.08); color: #2563eb; border-color: rgba(37,99,235,0.2); }
      `}</style>
    </div>
  )
}
