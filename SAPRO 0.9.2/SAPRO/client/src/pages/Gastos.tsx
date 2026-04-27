// ============================================================
// MÓDULO: Gastos
// Permite registrar, filtrar y cambiar el estatus de los
// egresos de la empresa. Cada gasto se asocia a un concepto,
// proyecto, usuario y opcionalmente a un proveedor.
// ============================================================

import { useState, useEffect } from 'react'

// ── Interfaces ───────────────────────────────────────────────
// Representa un registro de gasto con toda su metadata
interface Gasto {
  id: number
  monto: number
  fecha: string
  comprobante: string | null
  comprobanteId: string | null    // ID del comprobante en BD
  esProveedor: boolean            // true si el gasto viene de un proveedor
  concepto: string
  conceptoId: number
  formaPago: string
  formaPagoId: number
  proyecto: string
  proyectoId: number
  estatus: string
  estatusId: number
  usuario: string
  usuarioId: number
  proveedor: string | null
  proveedorId: number | null
}

// Catálogo genérico: id + nombre (conceptos, formas de pago, etc.)
interface Catalogo { id: number; nombre: string }
// Proyecto simplificado para los selects del formulario
interface Proyecto { id: string; nombre: string }
// Usuario simplificado para el select "registrado por"
interface Usuario { id: number; nombre: string; apellido: string }

interface GastosProps { token: string }

// Valores por defecto del formulario de nuevo gasto
// estatusId: '1' = Pendiente (valor inicial por defecto)
const emptyForm = {
  conceptoId: '', monto: '', fecha: new Date().toISOString().slice(0, 10),
  formaPagoId: '', comprobanteId: '', esProveedor: false,
  proveedorId: '', usuarioId: '', proyectoId: '', estatusId: '1'
}

// Mapeo de colores CSS para los badges de estatus en la tabla
const ESTATUS_COLORS: Record<string, string> = {
  'Pendiente':    'badge-warn',
  'Autorizado':   'badge-info',
  'Pagado':       'badge-active',
  'Rechazado':    'badge-error',
  'Reembolsado':  'badge-partial',
}

export default function Gastos({ token }: GastosProps) {

  // ── Estado: datos de la tabla ────────────────────────────
  const [gastos, setGastos]       = useState<Gasto[]>([])
  // Catálogos para los selects del formulario
  const [conceptos, setConceptos] = useState<Catalogo[]>([])
  const [formas, setFormas]       = useState<Catalogo[]>([])
  const [estatus, setEstatus]     = useState<Catalogo[]>([])
  const [proveedores, setProveedores]   = useState<Catalogo[]>([])
  const [comprobantes, setComprobantes] = useState<Catalogo[]>([])
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [usuarios, setUsuarios]   = useState<Usuario[]>([])
  const [loading, setLoading]     = useState(true)

  // ── Estado: filtros de búsqueda ──────────────────────────
  const [filterProyecto, setFilterProyecto]   = useState('')
  const [filterConcepto, setFilterConcepto]   = useState('')
  const [filterEstatus, setFilterEstatus]     = useState('')
  const [filterProveedor, setFilterProveedor] = useState('')
  const [filterFrom, setFilterFrom]           = useState('') // fecha desde
  const [filterTo, setFilterTo]               = useState('') // fecha hasta

  // ── Estado: modal de registro ────────────────────────────
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState(emptyForm)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  // Notificación temporal (toast) de éxito o error
  const [notif, setNotif]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // ── Estado: modal de cambio de estatus ──────────────────
  // estatusTarget: gasto al que se le cambiará el estatus
  const [estatusTarget, setEstatusTarget] = useState<Gasto | null>(null)
  const [estatusSelect, setEstatusSelect] = useState('')
  const [savingEstatus, setSavingEstatus] = useState(false)

  // Headers para todas las peticiones autenticadas
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Muestra un toast por 3 segundos y luego lo oculta
  const showNotif = (msg: string, type: 'success' | 'error' = 'success') => {
    setNotif({ msg, type })
    setTimeout(() => setNotif(null), 3000)
  }

  // ── Carga gastos desde la API, aplicando filtros opcionales ─
  // Los filtros se construyen como query params en la URL
  const fetchGastos = async (f = { proyectoId: filterProyecto, conceptoId: filterConcepto, estatusId: filterEstatus, proveedorId: filterProveedor, from: filterFrom, to: filterTo }) => {
    try {
      const p = new URLSearchParams()
      if (f.proyectoId)  p.set('projectId',   f.proyectoId)
      if (f.conceptoId)  p.set('conceptoId',  f.conceptoId)
      if (f.estatusId)   p.set('estatusId',   f.estatusId)
      if (f.proveedorId) p.set('proveedorId', f.proveedorId)
      if (f.from)        p.set('from',        f.from)
      if (f.to)          p.set('to',          f.to)
      const res = await fetch(`/api/gastos?${p}`, { headers })
      const data = await res.json()
      if (res.ok) setGastos(data)
      else showNotif(`Error al cargar gastos: ${data?.error || res.status}`, 'error')
    } catch (e) {
      showNotif(`Error de conexión: ${e instanceof Error ? e.message : 'desconocido'}`, 'error')
    } finally { setLoading(false) }
  }

  // ── Carga inicial: catálogos, proyectos, usuarios y gastos ─
  useEffect(() => {
    // Catálogos de gastos: conceptos, formas de pago, estatus, proveedores, comprobantes
    fetch('/api/gastos/catalogos', { headers }).then(r => r.ok ? r.json() : null).then(d => {
      if (d) {
        setConceptos(d.conceptos)
        setFormas(d.formas)
        setEstatus(d.estatus)
        setProveedores(d.proveedores)
        setComprobantes(d.comprobantes || [])
      }
    })
    // Lista de proyectos para el select del formulario
    fetch('/api/projects', { headers }).then(r => r.ok ? r.json() : []).then((data: any[]) =>
      setProyectos(data.map(p => ({ id: String(p.Pro_ID_Proyecto), nombre: p.Pro_Nombre })))
    )
    // Lista de usuarios para "registrado por"
    fetch('/api/usuarios', { headers }).then(r => r.ok ? r.json() : []).then(setUsuarios)
    // Gastos sin filtros al inicio
    fetchGastos({ proyectoId: '', conceptoId: '', estatusId: '', proveedorId: '', from: '', to: '' })
  }, [])

  // Aplica los filtros actuales del estado
  const applyFilters = () => fetchGastos()

  // Limpia todos los filtros y recarga la lista completa
  const clearFilters = () => {
    setFilterProyecto(''); setFilterConcepto(''); setFilterEstatus('')
    setFilterProveedor(''); setFilterFrom(''); setFilterTo('')
    fetchGastos({ proyectoId: '', conceptoId: '', estatusId: '', proveedorId: '', from: '', to: '' })
  }

  // ── POST /api/gastos — Crea un nuevo registro de gasto ──
  const handleCreate = async () => {
    // Validación de campos obligatorios
    if (!form.conceptoId || !form.monto || !form.fecha || !form.formaPagoId || !form.usuarioId || !form.proyectoId) {
      setError('Concepto, monto, fecha, forma de pago, usuario y proyecto son requeridos')
      return
    }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/gastos', {
        method: 'POST', headers,
        body: JSON.stringify({
          conceptoId:    Number(form.conceptoId),
          monto:         Number(form.monto),
          fecha:         form.fecha,
          formaPagoId:   Number(form.formaPagoId),
          comprobanteId: form.comprobanteId ? Number(form.comprobanteId) : null,
          esProveedor:   form.esProveedor,
          // Solo enviar proveedorId si el checkbox está activo
          proveedorId: form.esProveedor && form.proveedorId ? Number(form.proveedorId) : null,
          usuarioId:   Number(form.usuarioId),
          proyectoId:  Number(form.proyectoId),
          estatusId:   Number(form.estatusId)
        })
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      await fetchGastos()   // Recargar tabla
      setShowModal(false)
      setForm(emptyForm)    // Limpiar formulario
      showNotif('Gasto registrado')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setSaving(false) }
  }

  // Abre el modal de cambio de estatus con el gasto seleccionado
  const openEstatusModal = (g: Gasto) => {
    setEstatusTarget(g)
    setEstatusSelect(String(g.estatusId)) // Pre-selecciona el estatus actual
  }

  // ── PATCH /api/gastos/:id/estatus — Cambia el estatus del gasto ─
  const saveEstatus = async () => {
    if (!estatusTarget) return
    setSavingEstatus(true)
    try {
      const res = await fetch(`/api/gastos/${estatusTarget.id}/estatus`, {
        method: 'PATCH', headers, body: JSON.stringify({ estatusId: Number(estatusSelect) })
      })
      if (res.ok) {
        // Actualización optimista: modifica el estado local sin recargar toda la tabla
        const nombre = estatus.find(e => e.id === Number(estatusSelect))?.nombre || ''
        setGastos(prev => prev.map(g =>
          g.id === estatusTarget.id ? { ...g, estatusId: Number(estatusSelect), estatus: nombre } : g
        ))
        setEstatusTarget(null)
        showNotif('Estatus actualizado')
      } else {
        const d = await res.json().catch(() => ({}))
        showNotif(d.error || 'No se pudo actualizar', 'error')
      }
    } catch { showNotif('Error de conexión', 'error') }
    finally { setSavingEstatus(false) }
  }

  // ── Helpers de formato ───────────────────────────────────
  const formatMoney = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
  const formatDate  = (d: string) => d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  // ── Totales calculados del lado del cliente ──────────────
  const total     = gastos.reduce((s, g) => s + Number(g.monto), 0)
  const pagado    = gastos.filter(g => g.estatus === 'Pagado').reduce((s, g) => s + Number(g.monto), 0)
  const pendiente = gastos.filter(g => g.estatus === 'Pendiente').reduce((s, g) => s + Number(g.monto), 0)

  // ── RENDER ───────────────────────────────────────────────
  return (
    <div className="gastos-page fade-in">
      {/* Toast de notificación (éxito / error) */}
      {notif && <div className={`notification ${notif.type}`}>{notif.type === 'success' ? '✅' : '❌'} {notif.msg}</div>}

      {/* Tarjetas de resumen financiero */}
      <div className="ing-summary">
        <div className="ing-card">
          <div className="ing-card-label">Total registrado</div>
          <div className="ing-card-value">{formatMoney(total)}</div>
          <div className="ing-card-sub">{gastos.length} gasto{gastos.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="ing-card red">
          <div className="ing-card-label">Pagado</div>
          <div className="ing-card-value">{formatMoney(pagado)}</div>
        </div>
        <div className="ing-card yellow">
          <div className="ing-card-label">Pendiente</div>
          <div className="ing-card-value">{formatMoney(pendiente)}</div>
        </div>
      </div>

      {/* Barra de herramientas: filtros + botón de registro */}
      <div className="ing-toolbar">
        <div className="ing-filters">
          {/* Filtro por proyecto */}
          <select className="filter-select" value={filterProyecto} onChange={e => setFilterProyecto(e.target.value)}>
            <option value="">Todos los proyectos</option>
            {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          {/* Filtro por concepto de gasto */}
          <select className="filter-select" value={filterConcepto} onChange={e => setFilterConcepto(e.target.value)}>
            <option value="">Todos los conceptos</option>
            {conceptos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          {/* Filtro por estatus */}
          <select className="filter-select" value={filterEstatus} onChange={e => setFilterEstatus(e.target.value)}>
            <option value="">Todos los estatus</option>
            {estatus.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          {/* Filtro por proveedor */}
          <select className="filter-select" value={filterProveedor} onChange={e => setFilterProveedor(e.target.value)}>
            <option value="">Todos los proveedores</option>
            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          {/* Rango de fechas */}
          <input type="date" className="filter-select" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="Desde" />
          <input type="date" className="filter-select" value={filterTo}   onChange={e => setFilterTo(e.target.value)}   title="Hasta" />
          <button className="action-btn secondary" onClick={applyFilters}>Filtrar</button>
          <button className="action-btn secondary" onClick={clearFilters}>Limpiar</button>
        </div>
        {/* Botón para abrir el modal de nuevo gasto */}
        <button className="action-btn primary" onClick={() => { setForm(emptyForm); setError(''); setShowModal(true) }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Registrar Gasto
        </button>
      </div>

      {/* Tabla principal de gastos */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando gastos...</div>
      ) : gastos.length === 0 ? (
        // Estado vacío cuando no hay resultados
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          <h3>No hay gastos registrados</h3>
          <p>Haz clic en "Registrar Gasto" para agregar uno</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table" style={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Proyecto</th>
                <th>Monto</th>
                <th>Fecha</th>
                <th>Forma de Pago</th>
                <th>Usuario</th>
                <th>Proveedor</th>
                <th>Estatus</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map(g => (
                <tr key={g.id} className="fade-in">
                  <td style={{ fontWeight: 600 }}>{g.concepto}</td>
                  <td style={{ fontSize: '0.85rem' }}>{g.proyecto}</td>
                  <td style={{ fontWeight: 700, color: 'var(--error)' }}>{formatMoney(g.monto)}</td>
                  <td className="date-cell">{formatDate(g.fecha)}</td>
                  <td style={{ fontSize: '0.85rem' }}>{g.formaPago}</td>
                  <td style={{ fontSize: '0.85rem' }}>{g.usuario}</td>
                  <td style={{ fontSize: '0.85rem' }}>
                    {/* Muestra nombre del proveedor solo si es gasto de proveedor */}
                    {g.esProveedor && g.proveedor
                      ? <span style={{ color: 'var(--accent-primary)' }}>{g.proveedor}</span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td>
                    {/* Badge clickeable para cambiar el estatus del gasto */}
                    <button
                      className={`estatus-select ${ESTATUS_COLORS[g.estatus] || ''}`}
                      onClick={() => openEstatusModal(g)}
                    >
                      {g.estatus}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Registrar nuevo gasto ─────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-card fade-in" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h3>Registrar Gasto</h3>
            {error && <div style={{ color: 'var(--error)', marginBottom: 12, fontSize: '0.875rem' }}>{error}</div>}
            <div className="form-grid">
              {/* Proyecto (requerido) */}
              <div className="form-group">
                <label>Proyecto <span style={{ color: 'var(--error)' }}>*</span></label>
                <select className="modal-input" value={form.proyectoId} onChange={e => setForm(f => ({ ...f, proyectoId: e.target.value }))}>
                  <option value="">— Selecciona —</option>
                  {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              {/* Concepto de gasto (requerido) */}
              <div className="form-group">
                <label>Concepto <span style={{ color: 'var(--error)' }}>*</span></label>
                <select className="modal-input" value={form.conceptoId} onChange={e => setForm(f => ({ ...f, conceptoId: e.target.value }))}>
                  <option value="">— Selecciona —</option>
                  {conceptos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              {/* Monto en MXN (requerido) */}
              <div className="form-group">
                <label>Monto (MXN) <span style={{ color: 'var(--error)' }}>*</span></label>
                <input className="modal-input" type="number" min="0.01" step="0.01" placeholder="ej. 15000.00"
                  value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
              </div>
              {/* Fecha del gasto — max = hoy para no permitir fechas futuras */}
              <div className="form-group">
                <label>Fecha <span style={{ color: 'var(--error)' }}>*</span></label>
                <input className="modal-input" type="date" max={new Date().toISOString().slice(0, 10)}
                  value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
              </div>
              {/* Forma de pago */}
              <div className="form-group">
                <label>Forma de Pago <span style={{ color: 'var(--error)' }}>*</span></label>
                <select className="modal-input" value={form.formaPagoId} onChange={e => setForm(f => ({ ...f, formaPagoId: e.target.value }))}>
                  <option value="">— Selecciona —</option>
                  {formas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </select>
              </div>
              {/* Usuario que registra el gasto */}
              <div className="form-group">
                <label>Usuario que registra <span style={{ color: 'var(--error)' }}>*</span></label>
                <select className="modal-input" value={form.usuarioId} onChange={e => setForm(f => ({ ...f, usuarioId: e.target.value }))}>
                  <option value="">— Selecciona —</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>)}
                </select>
              </div>
              {/* Estatus inicial del gasto */}
              <div className="form-group">
                <label>Estatus</label>
                <select className="modal-input" value={form.estatusId} onChange={e => setForm(f => ({ ...f, estatusId: e.target.value }))}>
                  {estatus.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              {/* Checkbox para indicar si el gasto es de un proveedor */}
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 24 }}>
                <input type="checkbox" id="esProveedor" checked={form.esProveedor}
                  onChange={e => setForm(f => ({ ...f, esProveedor: e.target.checked, proveedorId: '' }))} />
                <label htmlFor="esProveedor" style={{ marginBottom: 0, cursor: 'pointer' }}>¿Es de proveedor?</label>
              </div>
              {/* Select de proveedor — solo visible si el checkbox está activo */}
              {form.esProveedor && (
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label>Proveedor</label>
                  <select className="modal-input" value={form.proveedorId} onChange={e => setForm(f => ({ ...f, proveedorId: e.target.value }))}>
                    <option value="">— Selecciona proveedor —</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              )}
              {/* Comprobante: opcional, viene de la BD de comprobantes */}
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Comprobante <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: 6 }}>(opcional)</span></label>
                <select className="modal-input" value={form.comprobanteId} onChange={e => setForm(f => ({ ...f, comprobanteId: e.target.value }))}>
                  <option value="">— Sin comprobante —</option>
                  {comprobantes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-actions" style={{ marginTop: 20, display: 'flex', gap: 12 }}>
              <button className="action-btn primary" onClick={handleCreate} disabled={saving}>
                {saving ? 'Guardando...' : 'Registrar'}
              </button>
              <button className="action-btn secondary" onClick={() => !saving && setShowModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Cambiar estatus de un gasto ───────────── */}
      {estatusTarget && (
        <div className="modal-overlay" onClick={() => !savingEstatus && setEstatusTarget(null)}>
          <div className="modal-card fade-in" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <h3>Cambiar Estatus</h3>
            {/* Muestra el concepto y monto del gasto seleccionado como contexto */}
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
              {estatusTarget.concepto} · {formatMoney(estatusTarget.monto)}
            </p>
            <div className="form-group">
              <label>Nuevo estatus</label>
              <select className="modal-input" value={estatusSelect} onChange={e => setEstatusSelect(e.target.value)}>
                {estatus.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
            <div className="modal-actions" style={{ marginTop: 20, display: 'flex', gap: 12 }}>
              <button className="action-btn primary" onClick={saveEstatus} disabled={savingEstatus}>
                {savingEstatus ? 'Guardando...' : 'Guardar'}
              </button>
              <button className="action-btn secondary" onClick={() => !savingEstatus && setEstatusTarget(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Estilos de tarjetas de resumen */}
      <style>{`
        .gastos-page .ing-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .gastos-page .ing-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 20px; }
        .gastos-page .ing-card-label { font-size: 0.78rem; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
        .gastos-page .ing-card-value { font-size: 1.4rem; font-weight: 700; color: var(--text-primary); }
        .gastos-page .ing-card-sub { font-size: 0.78rem; color: var(--text-muted); margin-top: 4px; }
        .gastos-page .ing-card.red .ing-card-value { color: #ef4444; }
        .gastos-page .ing-card.red { border-color: rgba(239,68,68,0.3); }
        .gastos-page .ing-card.yellow .ing-card-value { color: #eab308; }
        .gastos-page .ing-card.yellow { border-color: rgba(234,179,8,0.3); }
      `}</style>
    </div>
  )
}
