// ============================================================
// MÓDULO: Catálogos
// Descripción: Administración de todos los catálogos del sistema
//   (conceptos, formas de pago, estatus, tipos, etc.).
//   Usa un layout de dos paneles: sidebar con navegación de
//   catálogos agrupados + panel derecho con tabla y formulario.
// Rutas API utilizadas:
//   GET    /api/catalogos                        → trae TODOS los catálogos en un solo request
//   POST   /api/catalogos/:key                   → crear ítem
//   PUT    /api/catalogos/:key/:id               → editar ítem
//   DELETE /api/catalogos/:key/:id               → eliminar ítem
// El :key identifica qué tabla/catálogo se está operando
//   (ej. "concepto-gasto", "tipo-suscripcion", etc.)
// ============================================================

import { useState, useEffect } from 'react'

// ── Interfaces ──────────────────────────────────────────────

// Elemento genérico de catálogo (todos los catálogos comparten esta forma)
// duracion y precio solo aplican al catálogo "tipo-suscripcion"
interface CatalogItem { id: number; nombre: string; duracion?: number; precio?: number }

// Clave única que identifica cada catálogo en la API (ej. "concepto-gasto")
type CatalogKey = string

// Definición de un catálogo dentro de la navegación
interface CatalogDef {
  key: CatalogKey
  label: string
  extra?: 'tipo-suscripcion' // si tiene campos adicionales (duración/precio)
}

// ── Configuración de grupos y catálogos del sidebar ─────────
// Cada grupo agrupa catálogos relacionados con un encabezado visual
const GROUPS: { label: string; catalogs: CatalogDef[] }[] = [
  {
    label: 'Gastos',
    catalogs: [
      { key: 'concepto-gasto',  label: 'Conceptos de Gasto' },
      { key: 'forma-gasto',     label: 'Formas de Pago (Gasto)' },
      { key: 'estatus-gasto',   label: 'Estatus de Gasto' },
    ],
  },
  {
    label: 'Ingresos',
    catalogs: [
      { key: 'concepto-ingreso', label: 'Conceptos de Ingreso' },
      { key: 'forma-ingreso',    label: 'Formas de Pago (Ingreso)' },
      { key: 'estatus-ingreso',  label: 'Estatus de Ingreso' },
    ],
  },
  {
    label: 'Proyectos',
    catalogs: [
      { key: 'estado-proyecto',  label: 'Estados de Proyecto' },
      { key: 'puesto-proyecto',  label: 'Puestos en Proyecto' },
    ],
  },
  {
    label: 'Clientes',
    catalogs: [
      { key: 'tipo-cliente',    label: 'Tipos de Cliente' },
    ],
  },
  {
    label: 'Otros',
    catalogs: [
      { key: 'tipo-documento',      label: 'Tipos de Documento' },
      { key: 'proveedor',           label: 'Proveedores' },
      { key: 'estatus-suscripcion', label: 'Estatus de Suscripción' },
      // tipo-suscripcion es "especial": tiene campos extra (duración y precio)
      { key: 'tipo-suscripcion',    label: 'Tipos de Suscripción', extra: 'tipo-suscripcion' },
    ],
  },
]

// Lista plana de todas las definiciones (para buscar por key)
const ALL_DEFS = GROUPS.flatMap(g => g.catalogs)

interface CatalogosProps { token: string }

// Valores iniciales del formulario de crear/editar
const emptyForm = { nombre: '', duracion: '', precio: '' }

// ── Componente principal ─────────────────────────────────────
export default function Catalogos({ token }: CatalogosProps) {

  // ── Estado: catálogo activo en el sidebar ────────────────
  const [activeKey, setActiveKey]       = useState<CatalogKey>('concepto-gasto')

  // Todos los datos de todos los catálogos, indexados por key
  // Estructura: { "concepto-gasto": [...], "tipo-cliente": [...], ... }
  const [data, setData]                 = useState<Record<string, CatalogItem[]>>({})

  const [loading, setLoading]           = useState(true)
  const [editItem, setEditItem]         = useState<CatalogItem | null>(null) // null = crear
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState(emptyForm)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [deleteTarget, setDeleteTarget] = useState<CatalogItem | null>(null)
  const [deleting, setDeleting]         = useState(false)
  const [notif, setNotif]               = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // El catálogo "tipo-suscripcion" tiene campos extra en el formulario
  const isSpecial = activeKey === 'tipo-suscripcion'

  // Definición del catálogo actualmente seleccionado
  const activeDef = ALL_DEFS.find(d => d.key === activeKey)!

  // Ítems del catálogo activo (o array vacío si aún no se cargó)
  const items = data[activeKey] || []

  // ── Notificación temporal ────────────────────────────────
  const showNotif = (msg: string, type: 'success' | 'error' = 'success') => {
    setNotif({ msg, type })
    setTimeout(() => setNotif(null), 3000)
  }

  // ── Carga inicial: trae TODOS los catálogos en un solo request ──
  useEffect(() => {
    fetch('/api/catalogos', { headers })
      .then(r => r.ok ? r.json() : {})
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [])

  // ── Abrir formulario en modo CREAR ───────────────────────
  const openCreate = () => {
    setEditItem(null)
    setForm(emptyForm)
    setError('')
    setShowForm(true)
  }

  // ── Abrir formulario en modo EDITAR ─────────────────────
  const openEdit = (item: CatalogItem) => {
    setEditItem(item)
    setForm({
      nombre:   item.nombre,
      duracion: item.duracion?.toString() || '',
      precio:   item.precio?.toString()   || ''
    })
    setError('')
    setShowForm(true)
  }

  // ── Guardar ítem (crear o editar) ────────────────────────
  const handleSave = async () => {
    // Validación básica
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    if (isSpecial && (!form.duracion || !form.precio)) { setError('Duración y precio son requeridos'); return }

    setSaving(true); setError('')
    try {
      const body: Record<string, unknown> = { nombre: form.nombre.trim() }
      // Añade campos extra solo para tipo-suscripcion
      if (isSpecial) { body.duracion = Number(form.duracion); body.precio = Number(form.precio) }

      // PUT si editando, POST si creando
      const res = editItem
        ? await fetch(`/api/catalogos/${activeKey}/${editItem.id}`, { method: 'PUT',  headers, body: JSON.stringify(body) })
        : await fetch(`/api/catalogos/${activeKey}`,               { method: 'POST', headers, body: JSON.stringify(body) })

      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }

      if (editItem) {
        // Actualiza ítem en la lista local (actualización optimista)
        setData(prev => ({ ...prev, [activeKey]: prev[activeKey].map(i =>
          i.id === editItem.id ? { ...i, ...body } as CatalogItem : i
        )}))
        showNotif('Registro actualizado')
      } else {
        // Agrega el ítem creado al array y ordena alfabéticamente
        const created = await res.json()
        setData(prev => ({
          ...prev,
          [activeKey]: [...(prev[activeKey] || []), created].sort((a, b) => a.nombre.localeCompare(b.nombre))
        }))
        showNotif('Registro creado')
      }
      setShowForm(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al guardar') }
    finally { setSaving(false) }
  }

  // ── Eliminar ítem (con confirmación previa) ──────────────
  // El servidor rechazará el DELETE si el ítem está en uso por otras tablas (FK)
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/catalogos/${activeKey}/${deleteTarget.id}`, { method: 'DELETE', headers })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }

      // Quita el ítem del array local
      setData(prev => ({ ...prev, [activeKey]: prev[activeKey].filter(i => i.id !== deleteTarget.id) }))
      setDeleteTarget(null)
      setEditItem(null)
      setShowForm(false)
      setError('')
      showNotif('Registro eliminado')
    } catch (e) { showNotif(e instanceof Error ? e.message : 'Error al eliminar', 'error') }
    finally { setDeleting(false) }
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="fade-in" style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

      {/* ── Notificación flotante ── */}
      {notif && (
        <div className={`notification ${notif.type}`}>
          {notif.type === 'success' ? '✅' : '❌'} {notif.msg}
        </div>
      )}

      {/* ── Sidebar de navegación agrupada ── */}
      <aside style={{ width: 220, flexShrink: 0 }}>
        {GROUPS.map(g => (
          <div key={g.label} style={{ marginBottom: 20 }}>
            {/* Encabezado del grupo */}
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, paddingLeft: 8 }}>
              {g.label}
            </div>
            {/* Botones de selección de catálogo */}
            {g.catalogs.map(c => (
              <button
                key={c.key}
                onClick={() => {
                  setActiveKey(c.key)
                  setShowForm(false)  // cierra el formulario al cambiar de catálogo
                  setEditItem(null)
                  setError('')
                }}
                style={{
                  width: '100%', textAlign: 'left', padding: '7px 12px',
                  borderRadius: 6, border: 'none', cursor: 'pointer',
                  // Resalta el catálogo activo con color de acento
                  background: activeKey === c.key ? '#2563eb' : 'transparent',
                  color: activeKey === c.key ? '#fff' : 'var(--text-primary)',
                  fontSize: '0.85rem', fontWeight: activeKey === c.key ? 600 : 400,
                  marginBottom: 2, transition: 'all 0.12s',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}
              >
                <span>{c.label}</span>
                {/* Contador de ítems en el catálogo */}
                {data[c.key] && <span style={{ fontSize: '0.75rem', opacity: 0.75 }}>{data[c.key].length}</span>}
              </button>
            ))}
          </div>
        ))}
      </aside>

      {/* ── Panel principal: encabezado + formulario + tabla ── */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Encabezado del catálogo activo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{activeDef?.label}</h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {items.length} registro{items.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button className="action-btn primary" onClick={openCreate}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Agregar
          </button>
        </div>

        {/* ── Formulario inline de crear / editar ── */}
        {showForm && (
          <div className="form-card fade-in" style={{ marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 14px' }}>{editItem ? 'Editar registro' : 'Nuevo registro'}</h4>
            {error && <div style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: 10 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {/* Campo Nombre (común a todos los catálogos) */}
              <div className="form-group" style={{ flex: 2, minWidth: 180, marginBottom: 0 }}>
                <label>Nombre <span style={{ color: 'var(--error)' }}>*</span></label>
                <input
                  className="modal-input"
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder={`ej. ${activeKey === 'proveedor' ? 'Dell Technologies' : 'Nuevo elemento'}`}
                  onKeyDown={e => e.key === 'Enter' && handleSave()} // Enter guarda directamente
                />
              </div>

              {/* Campos extra: Duración y Precio (solo para tipo-suscripcion) */}
              {isSpecial && (
                <>
                  <div className="form-group" style={{ flex: 1, minWidth: 100, marginBottom: 0 }}>
                    <label>Duración (días) <span style={{ color: 'var(--error)' }}>*</span></label>
                    <input className="modal-input" type="number" min="1" value={form.duracion}
                      onChange={e => setForm(f => ({ ...f, duracion: e.target.value }))} placeholder="30" />
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: 120, marginBottom: 0 }}>
                    <label>Precio (MXN) <span style={{ color: 'var(--error)' }}>*</span></label>
                    <input className="modal-input" type="number" min="0" step="0.01" value={form.precio}
                      onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} placeholder="999.00" />
                  </div>
                </>
              )}

              {/* Botones del formulario */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 0 }}>
                <button className="action-btn primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Guardando...' : editItem ? 'Guardar' : 'Crear'}
                </button>
                <button className="action-btn secondary" onClick={() => { setShowForm(false); setError('') }}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Tabla de ítems del catálogo activo ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Cargando...</div>
        ) : items.length === 0 ? (
          // Estado vacío
          <div className="empty-state">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <h3>Sin registros</h3>
            <p>Haz clic en "Agregar" para crear el primero</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nombre</th>
                  {/* Columnas extra solo para tipo-suscripcion */}
                  {isSpecial && <><th>Duración</th><th>Precio</th></>}
                  <th style={{ width: 100 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id} className="fade-in">
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{item.nombre}</td>
                    {/* Celdas de duración/precio solo si es tipo-suscripcion */}
                    {isSpecial && (
                      <>
                        <td style={{ fontSize: '0.875rem' }}>{item.duracion} días</td>
                        <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                          {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(item.precio || 0)}
                        </td>
                      </>
                    )}
                    <td>
                      <div className="action-cell">
                        {/* Botón editar */}
                        <button className="icon-btn edit" onClick={() => openEdit(item)} title="Editar">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                          <span className="btn-label">Editar</span>
                        </button>

                        {/* Botón eliminar — el servidor rechaza si está en uso */}
                        <button className="icon-btn delete" onClick={() => setDeleteTarget(item)} title="Eliminar">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                          <span className="btn-label">Eliminar</span>
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

      {/* ── Modal: Confirmar eliminación ── */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="modal-card fade-in" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <h3>Eliminar registro</h3>
            <p style={{ color: 'var(--text-muted)', margin: '12px 0 20px' }}>
              ¿Eliminar <strong>"{deleteTarget.nombre}"</strong>? Si está en uso por otros registros, la operación será rechazada.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="action-btn"
                style={{ background: 'var(--error)', color: '#fff' }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
              <button className="action-btn secondary" onClick={() => !deleting && setDeleteTarget(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
