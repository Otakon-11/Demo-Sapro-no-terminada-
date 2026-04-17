import { useState, useEffect } from 'react'

export interface ProyectoItem {
  Pro_ID_Proyecto: number
  Pro_Nombre: string
  Pro_Descripcion: string | null
  Pro_Fecha_Inicio: string
  Pro_Fecha_Finalizacion: string | null
  Pro_Costo_Proyecto: number | null
  Epr_ID_Estatus_Proyecto: number | null
  estado: string | null
}

export interface EstadoProyectoItem {
  id: number
  nombre: string
}

interface ProjectsProps {
  token: string
}

export default function Projects({ token }: ProjectsProps) {
  const [projects, setProjects] = useState<ProyectoItem[]>([])
  const [estados, setEstados] = useState<EstadoProyectoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [viewProject, setViewProject] = useState<ProyectoItem | null>(null)
  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    fechaInicio: new Date().toISOString().slice(0, 10),
    fechaFin: '',
    costo: '',
    estadoId: '1'
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }

  useEffect(() => {
    if (!token) return
    Promise.all([
      fetch('/api/projects', { headers }).then(r => r.ok ? r.json() : []),
      fetch('/api/estados-proyecto', { headers }).then(r => r.ok ? r.json() : [])
    ]).then(([projs, est]) => {
      setProjects(Array.isArray(projs) ? projs : [])
      setEstados(Array.isArray(est) ? est : [])
    }).catch(() => setProjects([])).finally(() => setLoading(false))
  }, [token])

  const handleOpenAdd = () => {
    setEditingId(null)
    setForm({
      nombre: '',
      descripcion: '',
      fechaInicio: new Date().toISOString().slice(0, 10),
      fechaFin: '',
      costo: '',
      estadoId: estados[0]?.id?.toString() ?? '1'
    })
    setError('')
    setShowModal(true)
  }

  const handleOpenEdit = (proj: ProyectoItem) => {
    setEditingId(proj.Pro_ID_Proyecto)
    setForm({
      nombre: proj.Pro_Nombre,
      descripcion: proj.Pro_Descripcion || '',
      fechaInicio: proj.Pro_Fecha_Inicio ? proj.Pro_Fecha_Inicio.slice(0, 10) : new Date().toISOString().slice(0, 10),
      fechaFin: proj.Pro_Fecha_Finalizacion ? proj.Pro_Fecha_Finalizacion.slice(0, 10) : '',
      costo: proj.Pro_Costo_Proyecto != null ? proj.Pro_Costo_Proyecto.toString() : '',
      estadoId: proj.Epr_ID_Estatus_Proyecto ? proj.Epr_ID_Estatus_Proyecto.toString() : '1'
    })
    setError('')
    setViewProject(null)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      setError('El nombre del proyecto es obligatorio')
      return
    }
    setSaving(true)
    setError('')
    try {
      const isEditing = editingId != null
      const url = isEditing ? `/api/projects/${editingId}` : '/api/projects'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim() || null,
          fechaInicio: form.fechaInicio || null,
          fechaFin: form.fechaFin.trim() || null,
          costo: form.costo ? Number(form.costo) : null,
          estadoId: form.estadoId ? Number(form.estadoId) : 1
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || (isEditing ? 'Error al actualizar' : 'Error al crear'))
      }
      const savedProject = await res.json()
      if (isEditing) {
        setProjects(prev => prev.map(p => p.Pro_ID_Proyecto === editingId ? savedProject : p))
      } else {
        setProjects(prev => [savedProject, ...prev])
      }
      setShowModal(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar el proyecto')
    } finally {
      setSaving(false)
    }
  }

  const byEstado = estados.length
    ? [
        ...estados.map(e => ({ id: e.id, nombre: e.nombre, proyectos: projects.filter(p => p.Epr_ID_Estatus_Proyecto === e.id) })),
        ...(projects.some(p => p.Epr_ID_Estatus_Proyecto == null) ? [{ id: -1, nombre: 'Sin asignar', proyectos: projects.filter(p => p.Epr_ID_Estatus_Proyecto == null) }] : [])
      ]
    : [{ id: 0, nombre: 'Todos', proyectos: projects }]

  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
  const formatMoney = (n: number | null) => (n != null ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n) : '—')

  return (
    <div className="projects-page fade-in">
      <div className="projects-toolbar">
        <button type="button" className="action-btn primary" onClick={handleOpenAdd}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo Proyecto
        </button>
      </div>

      {loading ? (
        <div className="projects-loading">Cargando proyectos...</div>
      ) : (
        <div className="kanban-board">
          {byEstado.map(col => (
            <div key={col.id} className="kanban-column">
              <div className="kanban-header">
                <span className="kanban-title">{col.nombre}</span>
                <span className="kanban-count">{col.proyectos.length}</span>
              </div>
              <div className="kanban-cards">
                {col.proyectos.map(proj => (
                  <div key={proj.Pro_ID_Proyecto} className="kanban-card" style={{ cursor: 'pointer' }} onClick={() => setViewProject(proj)}>
                    <div className="kanban-card-title">{proj.Pro_Nombre}</div>
                    <div className="kanban-card-desc">{proj.Pro_Descripcion || 'Sin descripción'}</div>
                    <div className="kanban-card-meta">
                      <span>Inicio: {formatDate(proj.Pro_Fecha_Inicio)}</span>
                      {proj.Pro_Fecha_Finalizacion && <span>Fin: {formatDate(proj.Pro_Fecha_Finalizacion)}</span>}
                      {proj.Pro_Costo_Proyecto != null && <span>{formatMoney(proj.Pro_Costo_Proyecto)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-container projects-modal" onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => !saving && setShowModal(false)} aria-label="Cerrar">
              ×
            </button>
            <h3>{editingId != null ? 'Editar proyecto' : 'Nuevo proyecto'}</h3>
            {error && <div className="form-error" style={{ color: 'var(--error)', marginBottom: 12 }}>{error}</div>}
            <div className="form-group">
              <label>Nombre *</label>
              <input
                className="modal-input"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre del proyecto"
              />
            </div>
            <div className="form-group">
              <label>Descripción</label>
              <textarea
                className="modal-input"
                rows={3}
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Descripción opcional"
                style={{ resize: 'none' }}
              />
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select
                className="modal-input"
                value={form.estadoId}
                onChange={e => setForm(f => ({ ...f, estadoId: e.target.value }))}
              >
                {estados.map(e => (
                  <option key={e.id} value={e.id}>{e.nombre}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Fecha inicio</label>
                <input
                  type="date"
                  className="modal-input"
                  value={form.fechaInicio}
                  onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Fecha fin</label>
                <input
                  type="date"
                  className="modal-input"
                  value={form.fechaFin}
                  onChange={e => setForm(f => ({ ...f, fechaFin: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Costo (MXN)</label>
              <input
                type="number"
                className="modal-input"
                value={form.costo}
                onChange={e => setForm(f => ({ ...f, costo: e.target.value }))}
                placeholder="Opcional"
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="action-btn primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : (editingId != null ? 'Guardar Cambios' : 'Crear proyecto')}
              </button>
              <button type="button" className="action-btn secondary" onClick={() => !saving && setShowModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {viewProject && (
        <div className="modal-overlay" onClick={() => setViewProject(null)}>
          <div className="modal-container projects-modal" onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => setViewProject(null)} aria-label="Cerrar">
              ×
            </button>
            <h3>Detalles del Proyecto</h3>
            
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <strong>Nombre:</strong>
                <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>{viewProject.Pro_Nombre}</div>
              </div>
              
              <div>
                <strong>Descripción:</strong>
                <div style={{ color: 'var(--text-muted)', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                  {viewProject.Pro_Descripcion || 'Sin descripción detallada.'}
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <strong>Fecha de Inicio:</strong>
                  <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>{formatDate(viewProject.Pro_Fecha_Inicio)}</div>
                </div>
                <div className="form-group">
                  <strong>Fecha de Finalización:</strong>
                  <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>{formatDate(viewProject.Pro_Fecha_Finalizacion)}</div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <strong>Costo del Proyecto:</strong>
                  <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>{viewProject.Pro_Costo_Proyecto != null ? formatMoney(viewProject.Pro_Costo_Proyecto) : 'No especificado'}</div>
                </div>
                <div className="form-group">
                  <strong>Estado Actual:</strong>
                  <div style={{ marginTop: '4px', display: 'inline-block' }}>
                    <span className="kanban-title" style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                      {viewProject.estado || 'Sin asignar'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '30px', justifyContent: 'flex-end', display: 'flex', gap: '10px' }}>
              <button type="button" className="action-btn primary" onClick={() => handleOpenEdit(viewProject)}>
                Editar Proyecto
              </button>
              <button type="button" className="action-btn secondary" onClick={() => setViewProject(null)}>
                Cerrar Detalles
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .projects-toolbar { margin-bottom: 20px; }
        .projects-loading { padding: 40px; text-align: center; color: var(--text-muted); }
        .kanban-card-meta { font-size: 0.8rem; color: var(--text-muted); margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px; }
        .projects-modal .form-row { display: flex; gap: 16px; }
        .projects-modal .form-row .form-group { flex: 1; }
        .projects-modal .modal-actions { display: flex; gap: 12px; margin-top: 20px; }
      `}</style>
    </div>
  )
}
