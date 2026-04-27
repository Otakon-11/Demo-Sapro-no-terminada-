// ============================================================
// MÓDULO: Ingresos
// Permite registrar, filtrar y gestionar los ingresos de la
// empresa. Cada ingreso se asocia a un proyecto, concepto y
// forma de pago. El comprobante (PDF) puede asignarse al
// crear o después desde la tabla.
// ============================================================

import { useState, useEffect } from 'react'

// ── Interfaces ───────────────────────────────────────────────
// Representa un registro de ingreso con toda su metadata
interface Ingreso {
  id: number
  monto: number
  fecha: string
  comprobante: string | null  // Nombre de archivo del PDF comprobante
  concepto: string
  conceptoId: number
  formaPago: string
  formaPagoId: number
  proyecto: string
  proyectoId: number
  estatus: string
  estatusId: number
}

// Catálogo genérico id + nombre (conceptos, formas, estatus)
interface Catalogo { id: number; nombre: string }
// Proyecto simplificado para el select del formulario
interface Proyecto { id: string; nombre: string }
// Archivo PDF subido (para el selector de comprobante)
interface Archivo  { filename: string; originalname: string }

interface IngresosProps { token: string }

// Valores por defecto del formulario de nuevo ingreso
// estatusId: '1' = Pendiente
const emptyForm = {
  conceptoId: '', monto: '', fecha: new Date().toISOString().slice(0, 10),
  formaPagoId: '', comprobante: '', proyectoId: '', estatusId: '1'
}

// Colores CSS para los badges de estatus en la tabla
const ESTATUS_COLORS: Record<string, string> = {
  'Pendiente':  'badge-warn',
  'Confirmado': 'badge-info',
  'Depositado': 'badge-active',
  'Rechazado':  'badge-error',
  'Parcial':    'badge-partial',
}

export default function Ingresos({ token }: IngresosProps) {

  // ── Estado: datos de la tabla ────────────────────────────
  const [ingresos, setIngresos]   = useState<Ingreso[]>([])
  // Catálogos para los selects del formulario
  const [conceptos, setConceptos] = useState<Catalogo[]>([])
  const [formas, setFormas]       = useState<Catalogo[]>([])
  const [estatus, setEstatus]     = useState<Catalogo[]>([])
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  // Archivos PDF disponibles para seleccionar como comprobante
  const [archivos, setArchivos]   = useState<Archivo[]>([])
  const [loading, setLoading]     = useState(true)

  // ── Estado: filtros de búsqueda ──────────────────────────
  const [filterProyecto, setFilterProyecto] = useState('')
  const [filterEstatus, setFilterEstatus]   = useState('')
  const [filterFrom, setFilterFrom]         = useState('') // fecha desde
  const [filterTo, setFilterTo]             = useState('') // fecha hasta

  // ── Estado: modal principal de registro ─────────────────
  const [showModal, setShowModal]   = useState(false)
  const [form, setForm]             = useState(emptyForm)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  // Toast de notificación temporal
  const [notif, setNotif]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // ── Estado: modal de comprobante ─────────────────────────
  // comprobanteTarget: el ingreso al que se le asignará el archivo
  const [comprobanteTarget, setComprobanteTarget] = useState<Ingreso | null>(null)
  const [comprobanteSelect, setComprobanteSelect] = useState('')
  const [savingComprobante, setSavingComprobante] = useState(false)

  // ── Estado: modal de cambio de estatus ──────────────────
  const [estatusTarget, setEstatusTarget]   = useState<Ingreso | null>(null)
  const [estatusSelect, setEstatusSelect]   = useState('')
  const [savingEstatus, setSavingEstatus]   = useState(false)

  // Headers para peticiones autenticadas
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Muestra un toast por 3 segundos
  const showNotif = (msg: string, type: 'success' | 'error' = 'success') => {
    setNotif({ msg, type })
    setTimeout(() => setNotif(null), 3000)
  }

  // ── GET /api/ingresos — Carga ingresos con filtros opcionales ─
  const fetchIngresos = async (filters = { proyectoId: filterProyecto, estatusId: filterEstatus, from: filterFrom, to: filterTo }) => {
    try {
      const p = new URLSearchParams()
      if (filters.proyectoId) p.set('projectId', filters.proyectoId)
      if (filters.estatusId)  p.set('estatusId', filters.estatusId)
      if (filters.from)       p.set('from', filters.from)
      if (filters.to)         p.set('to', filters.to)
      const res = await fetch(`/api/ingresos?${p}`, { headers })
      if (res.ok) setIngresos(await res.json())
    } catch { /* ignorar errores de red */ } finally { setLoading(false) }
  }

  // ── Carga inicial: catálogos, proyectos, archivos e ingresos ─
  useEffect(() => {
    // Catálogos de ingresos: conceptos, formas de pago y estatus
    fetch('/api/ingresos/catalogos', { headers }).then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setConceptos(d.conceptos); setFormas(d.formas); setEstatus(d.estatus) }
    })
    // Lista de proyectos (se muestra en el select del formulario)
    fetch('/api/projects', { headers }).then(r => r.ok ? r.json() : []).then((data: any[]) =>
      setProyectos(data.map(p => ({ id: String(p.Pro_ID_Proyecto), nombre: p.Pro_Nombre })))
    )
    // Archivos PDF subidos (para asignar como comprobante)
    fetch('/api/files', { headers }).then(r => r.ok ? r.json() : []).then((data: Archivo[]) =>
      setArchivos(data)
    )
    fetchIngresos({ proyectoId: '', estatusId: '', from: '', to: '' })
  }, [])

  // Aplica los filtros del estado actual
  const applyFilters = () => fetchIngresos()

  // Limpia todos los filtros y recarga la lista completa
  const clearFilters = () => {
    setFilterProyecto(''); setFilterEstatus(''); setFilterFrom(''); setFilterTo('')
    fetchIngresos({ proyectoId: '', estatusId: '', from: '', to: '' })
  }

  // ── POST /api/ingresos — Crea un nuevo registro ──────────
  const handleCreate = async () => {
    if (!form.conceptoId || !form.monto || !form.fecha || !form.formaPagoId || !form.proyectoId) {
      setError('Concepto, monto, fecha, forma de pago y proyecto son requeridos')
      return
    }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/ingresos', {
        method: 'POST', headers,
        body: JSON.stringify({
          conceptoId: Number(form.conceptoId), monto: Number(form.monto),
          fecha: form.fecha, formaPagoId: Number(form.formaPagoId),
          comprobante: form.comprobante || null, // null si no se seleccionó archivo
          proyectoId: Number(form.proyectoId), estatusId: Number(form.estatusId)
        })
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      await fetchIngresos()  // Recargar tabla
      setShowModal(false)
      setForm(emptyForm)
      showNotif('Ingreso registrado')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setSaving(false) }
  }

  // Abre el modal de cambio de estatus con el ingreso seleccionado
  const openEstatusModal = (ing: Ingreso) => {
    setEstatusTarget(ing)
    setEstatusSelect(String(ing.estatusId)) // Pre-selecciona el estatus actual
  }

  // ── PATCH /api/ingresos/:id/estatus — Cambia el estatus ─
  const saveEstatus = async () => {
    if (!estatusTarget) return
    setSavingEstatus(true)
    try {
      const res = await fetch(`/api/ingresos/${estatusTarget.id}/estatus`, {
        method: 'PATCH', headers, body: JSON.stringify({ estatusId: Number(estatusSelect) })
      })
      if (res.ok) {
        // Actualización optimista del estado local
        const nombreEstatus = estatus.find(e => e.id === Number(estatusSelect))?.nombre || ''
        setIngresos(prev => prev.map(i =>
          i.id === estatusTarget.id ? { ...i, estatusId: Number(estatusSelect), estatus: nombreEstatus } : i
        ))
        setEstatusTarget(null)
        showNotif('Estatus actualizado')
      } else {
        const d = await res.json().catch(() => ({}))
        showNotif(d.error || 'No se pudo guardar el estatus', 'error')
      }
    } catch { showNotif('Error de conexión', 'error') }
    finally { setSavingEstatus(false) }
  }

  // Abre el modal de comprobante con el ingreso seleccionado
  const openComprobanteModal = (ing: Ingreso) => {
    setComprobanteTarget(ing)
    setComprobanteSelect(ing.comprobante || '') // Pre-selecciona el archivo actual si existe
  }

  // ── PATCH /api/ingresos/:id/comprobante — Asigna archivo PDF ─
  const saveComprobante = async () => {
    if (!comprobanteTarget) return
    setSavingComprobante(true)
    try {
      const res = await fetch(`/api/ingresos/${comprobanteTarget.id}/comprobante`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ comprobante: comprobanteSelect || null }) // null = quitar comprobante
      })
      if (res.ok) {
        // Actualización optimista del campo comprobante en la tabla
        setIngresos(prev => prev.map(i =>
          i.id === comprobanteTarget.id ? { ...i, comprobante: comprobanteSelect || null } : i
        ))
        setComprobanteTarget(null)
        showNotif('Comprobante asignado')
      } else {
        showNotif('Error al guardar comprobante', 'error')
      }
    } catch { showNotif('Error de conexión', 'error') }
    finally { setSavingComprobante(false) }
  }

  // ── Helpers de formato ───────────────────────────────────
  const formatMoney = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
  const formatDate  = (d: string) => d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  // Busca el nombre legible de un archivo PDF por su filename
  const archivoNombre = (filename: string | null) => {
    if (!filename) return null
    return archivos.find(a => a.filename === filename)?.originalname || filename
  }

  // ── Totales calculados del lado del cliente ──────────────
  const total      = ingresos.reduce((s, i) => s + Number(i.monto), 0)
  const depositado = ingresos.filter(i => i.estatus === 'Depositado').reduce((s, i) => s + Number(i.monto), 0)
  const pendiente  = ingresos.filter(i => i.estatus === 'Pendiente').reduce((s, i) => s + Number(i.monto), 0)

  // ── RENDER ───────────────────────────────────────────────
  return (
    <div className="ingresos-page fade-in">
      {/* Toast de notificación */}
      {notif && <div className={`notification ${notif.type}`}>{notif.type === 'success' ? '✅' : '❌'} {notif.msg}</div>}

      {/* Tarjetas de resumen financiero */}
      <div className="ing-summary">
        <div className="ing-card">
          <div className="ing-card-label">Total registrado</div>
          <div className="ing-card-value">{formatMoney(total)}</div>
          <div className="ing-card-sub">{ingresos.length} ingreso{ingresos.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="ing-card green">
          <div className="ing-card-label">Depositado</div>
          <div className="ing-card-value">{formatMoney(depositado)}</div>
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
          {/* Filtro por estatus */}
          <select className="filter-select" value={filterEstatus} onChange={e => setFilterEstatus(e.target.value)}>
            <option value="">Todos los estatus</option>
            {estatus.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          {/* Rango de fechas */}
          <input type="date" className="filter-select" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="Desde" />
          <input type="date" className="filter-select" value={filterTo}   onChange={e => setFilterTo(e.target.value)}   title="Hasta" />
          <button className="action-btn secondary" onClick={applyFilters}>Filtrar</button>
          <button className="action-btn secondary" onClick={clearFilters}>Limpiar</button>
        </div>
        {/* Botón para abrir el modal de nuevo ingreso */}
        <button className="action-btn primary" onClick={() => { setForm(emptyForm); setError(''); setShowModal(true) }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Registrar Ingreso
        </button>
      </div>

      {/* Tabla principal de ingresos */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando ingresos...</div>
      ) : ingresos.length === 0 ? (
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          <h3>No hay ingresos registrados</h3>
          <p>Haz clic en "Registrar Ingreso" para agregar uno</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table" style={{ minWidth: 920 }}>
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Proyecto</th>
                <th>Monto</th>
                <th>Fecha</th>
                <th>Forma de Pago</th>
                <th>Comprobante</th>
                <th>Estatus</th>
              </tr>
            </thead>
            <tbody>
              {ingresos.map(ing => (
                <tr key={ing.id} className="fade-in">
                  <td style={{ fontWeight: 600 }}>{ing.concepto}</td>
                  <td style={{ fontSize: '0.85rem' }}>{ing.proyecto}</td>
                  <td style={{ fontWeight: 700 }}>{formatMoney(ing.monto)}</td>
                  <td className="date-cell">{formatDate(ing.fecha)}</td>
                  <td style={{ fontSize: '0.85rem' }}>{ing.formaPago}</td>
                  {/* Celda de comprobante: muestra nombre del archivo o botón para asignar */}
                  <td>
                    {ing.comprobante ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {/* Muestra nombre legible del archivo PDF */}
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }} title={ing.comprobante}>
                          {archivoNombre(ing.comprobante) ?? ing.comprobante}
                        </span>
                        {/* Botón para cambiar el comprobante */}
                        <button className="icon-btn" title="Cambiar" onClick={() => openComprobanteModal(ing)} style={{ padding: '2px 4px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                      </div>
                    ) : (
                      // Botón para asignar comprobante si no tiene
                      <button className="icon-btn view" onClick={() => openComprobanteModal(ing)} style={{ fontSize: '0.78rem', padding: '3px 8px' }}>
                        + Asignar
                      </button>
                    )}
                  </td>
                  {/* Badge clickeable para cambiar estatus */}
                  <td>
                    <button
                      className={`estatus-select ${ESTATUS_COLORS[ing.estatus] || ''}`}
                      onClick={() => openEstatusModal(ing)}
                      style={{ cursor: 'pointer', border: '1px solid' }}
                    >
                      {ing.estatus}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Registrar nuevo ingreso ────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-card fade-in" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h3>Registrar Ingreso</h3>
            {error && <div style={{ color: 'var(--error)', marginBottom: 12, fontSize: '0.875rem' }}>{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label>Proyecto <span style={{ color: 'var(--error)' }}>*</span></label>
                <select className="modal-input" value={form.proyectoId} onChange={e => setForm(f => ({ ...f, proyectoId: e.target.value }))}>
                  <option value="">— Selecciona —</option>
                  {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Concepto <span style={{ color: 'var(--error)' }}>*</span></label>
                <select className="modal-input" value={form.conceptoId} onChange={e => setForm(f => ({ ...f, conceptoId: e.target.value }))}>
                  <option value="">— Selecciona —</option>
                  {conceptos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Monto (MXN) <span style={{ color: 'var(--error)' }}>*</span></label>
                <input className="modal-input" type="number" min="0" step="0.01" placeholder="ej. 50000.00"
                  value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Fecha <span style={{ color: 'var(--error)' }}>*</span></label>
                <input className="modal-input" type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Forma de Pago <span style={{ color: 'var(--error)' }}>*</span></label>
                <select className="modal-input" value={form.formaPagoId} onChange={e => setForm(f => ({ ...f, formaPagoId: e.target.value }))}>
                  <option value="">— Selecciona —</option>
                  {formas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Estatus</label>
                <select className="modal-input" value={form.estatusId} onChange={e => setForm(f => ({ ...f, estatusId: e.target.value }))}>
                  {estatus.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              {/* Comprobante opcional — también puede asignarse después desde la tabla */}
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>
                  Comprobante
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: 6 }}>(opcional — puedes asignarlo después)</span>
                </label>
                <select className="modal-input" value={form.comprobante} onChange={e => setForm(f => ({ ...f, comprobante: e.target.value }))}>
                  <option value="">— Sin comprobante por ahora —</option>
                  {archivos.map(a => <option key={a.filename} value={a.filename}>{a.originalname}</option>)}
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

      {/* ── Modal: Cambiar estatus de un ingreso ──────────── */}
      {estatusTarget && (
        <div className="modal-overlay" onClick={() => !savingEstatus && setEstatusTarget(null)}>
          <div className="modal-card fade-in" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <h3>Cambiar Estatus</h3>
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

      {/* ── Modal: Asignar / cambiar comprobante PDF ──────── */}
      {comprobanteTarget && (
        <div className="modal-overlay" onClick={() => !savingComprobante && setComprobanteTarget(null)}>
          <div className="modal-card fade-in" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h3>Asignar Comprobante</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
              {comprobanteTarget.concepto} · {formatMoney(comprobanteTarget.monto)}
            </p>
            <div className="form-group">
              <label>Archivo PDF</label>
              <select className="modal-input" value={comprobanteSelect} onChange={e => setComprobanteSelect(e.target.value)}>
                <option value="">— Sin comprobante —</option>
                {archivos.map(a => <option key={a.filename} value={a.filename}>{a.originalname}</option>)}
              </select>
              {/* Aviso si no hay archivos subidos todavía */}
              {archivos.length === 0 && (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  No hay archivos subidos. Ve a "Archivos PDF" para subir uno primero.
                </p>
              )}
            </div>
            <div className="modal-actions" style={{ marginTop: 20, display: 'flex', gap: 12 }}>
              <button className="action-btn primary" onClick={saveComprobante} disabled={savingComprobante}>
                {savingComprobante ? 'Guardando...' : 'Guardar'}
              </button>
              <button className="action-btn secondary" onClick={() => !savingComprobante && setComprobanteTarget(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Estilos CSS específicos del módulo de ingresos */}
      <style>{`
        .ing-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .ing-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 20px; }
        .ing-card.green  { border-color: rgba(34,197,94,0.3); }
        .ing-card.yellow { border-color: rgba(234,179,8,0.3); }
        .ing-card-label { font-size: 0.78rem; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
        .ing-card-value { font-size: 1.4rem; font-weight: 700; color: var(--text-primary); }
        .ing-card.green  .ing-card-value { color: #22c55e; }
        .ing-card.yellow .ing-card-value { color: #eab308; }
        .ing-card-sub { font-size: 0.78rem; color: var(--text-muted); margin-top: 4px; }
        .ing-toolbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
        .ing-filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .estatus-select { background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 4px 8px; font-size: 0.78rem; cursor: pointer; }
        .estatus-select.badge-active  { border-color: rgba(34,197,94,0.4);  color: #22c55e; }
        .estatus-select.badge-warn    { border-color: rgba(234,179,8,0.4);   color: #eab308; }
        .estatus-select.badge-error   { border-color: rgba(255,68,68,0.4);   color: var(--error); }
        .estatus-select.badge-info    { border-color: rgba(59,130,246,0.4);  color: #3b82f6; }
        .estatus-select.badge-partial { border-color: rgba(168,85,247,0.4);  color: #a855f7; }
      `}</style>
    </div>
  )
}
