// ============================================================
// MÓDULO: Proyects (Proyectos)
// Descripción: Gestión completa de proyectos: crear, ver detalle,
//   editar, cambiar estatus y administrar los miembros del equipo.
// Rutas API utilizadas:
//   GET    /api/projects              → lista de proyectos con dirección y estado
//   POST   /api/projects              → crear proyecto
//   PUT    /api/projects/:id          → editar proyecto
//   PATCH  /api/projects/:id/estatus  → cambiar estatus (si ID=4=Terminado → guarda fecha fin)
//   GET    /api/estados-proyecto      → catálogo de estados
//   GET    /api/usuarios              → lista de usuarios (para agregar al equipo)
//   GET    /api/projects/:id/usuarios → miembros del proyecto
//   POST   /api/projects/:id/usuarios → agregar miembro
//   DELETE /api/projects/:id/usuarios/:uid → quitar miembro
// Nota: las interfaces ProyectoItem, EstadoProyectoItem y UsuarioItem
//   son exportadas porque también las usa Dashboard.tsx.
// ============================================================

import { useState, useEffect } from 'react'

// ── Interfaces exportadas (usadas en otros módulos) ──────────

// Proyecto tal como llega del servidor (campos en PascalCase/snake_case mixto)
export interface ProyectoItem {
  Pro_ID_Proyecto: number
  Pro_Nombre: string
  Pro_Descripcion: string | null
  Pro_Fecha_Inicio: string
  Pro_Fecha_Finalizacion: string | null
  Pro_Costo_Proyecto: number | null
  Epr_ID_Estatus_Proyecto: number | null
  estado: string | null            // nombre del estado (join)
  direccionCompleta: string | null // dirección armada con CONCAT_WS en el backend
}

// Estatus de proyecto del catálogo Estado_Proyecto
export interface EstadoProyectoItem {
  id: number
  nombre: string
}

// Usuario miembro de un proyecto (también usado en el selector de usuarios disponibles)
export interface UsuarioItem {
  id: number
  nombre: string
  apellido: string
  correo: string
  puestoId?: number // ID del puesto en el proyecto (de Proyecto_Usuario)
}

interface ProjectsProps {
  token: string
}

// ── Componente principal ─────────────────────────────────────
export default function Projects({ token }: ProjectsProps) {

  // ── Estado: datos ──────────────────────────────────────────
  const [projects, setProjects]   = useState<ProyectoItem[]>([])
  const [estados, setEstados]     = useState<EstadoProyectoItem[]>([])
  const [loading, setLoading]     = useState(true)

  // ── Estado: modal de crear proyecto ───────────────────────
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    nombre: '', descripcion: '',
    fechaInicio: new Date().toISOString().slice(0, 10), // fecha de hoy por defecto
    fechaFin: '', costo: '', estadoId: '1'
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // ── Estado: modal de detalle / edición de proyecto ────────
  const [selectedProject, setSelectedProject]     = useState<ProyectoItem | null>(null)
  const [showDetailsModal, setShowDetailsModal]   = useState(false)
  const [updatingStatus, setUpdatingStatus]       = useState(false)
  const [detailsStatusId, setDetailsStatusId]     = useState('1') // ID del estatus seleccionado en detalle
  const [editMode, setEditMode]                   = useState(false) // toggle lectura/edición en detalle
  const [editForm, setEditForm] = useState({ nombre: '', descripcion: '', fechaInicio: '', fechaFin: '', costo: '', estadoId: '1' })

  // ── Estado: equipo del proyecto ───────────────────────────
  const [allUsers, setAllUsers]           = useState<UsuarioItem[]>([]) // todos los usuarios disponibles
  const [projectUsers, setProjectUsers]   = useState<UsuarioItem[]>([]) // miembros actuales del proyecto
  const [selectedUserId, setSelectedUserId] = useState('')              // usuario seleccionado para agregar
  const [usersLoading, setUsersLoading]   = useState(false)

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }

  // ── Carga inicial: proyectos + catálogo de estados + lista de usuarios ──
  useEffect(() => {
    if (!token) return
    Promise.all([
      fetch('/api/projects',         { headers }).then(r => r.ok ? r.json() : []),
      fetch('/api/estados-proyecto', { headers }).then(r => r.ok ? r.json() : []),
      fetch('/api/usuarios',         { headers }).then(r => r.ok ? r.json() : [])
    ]).then(([projs, est, users]) => {
      setProjects(Array.isArray(projs)  ? projs  : [])
      setEstados(Array.isArray(est)     ? est    : [])
      setAllUsers(Array.isArray(users)  ? users  : [])
    }).catch(() => setProjects([])).finally(() => setLoading(false))
  }, [token])

  const handleOpenAdd = () => {
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

  const handleCreate = async () => {
    if (!form.nombre.trim()) {
      setError('El nombre del proyecto es obligatorio')
      return
    }
    if (form.fechaInicio && form.fechaFin) {
      if (new Date(form.fechaFin) < new Date(form.fechaInicio)) {
        setError('La fecha de finalización no puede ser anterior a la de inicio')
        return
      }
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
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
        throw new Error(data.error || 'Error al crear')
      }
      const newProject = await res.json()
      setProjects(prev => [newProject, ...prev])
      setShowModal(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear el proyecto')
    } finally {
      setSaving(false)
    }
  }

  // Abre el modal de detalle y carga los miembros del proyecto en paralelo
  const handleOpenDetails = async (proj: ProyectoItem) => {
    setSelectedProject(proj)
    setDetailsStatusId(proj.Epr_ID_Estatus_Proyecto?.toString() || '1')
    setEditMode(false)
    setShowDetailsModal(true)
    setError('')
    setProjectUsers([])
    setUsersLoading(true)

    try {
      const res = await fetch(`/api/projects/${proj.Pro_ID_Proyecto}/usuarios`, { headers })
      if (res.ok) {
        const data = await res.json()
        setProjectUsers(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error fetching users:', err)
    } finally {
      setUsersLoading(false)
    }
  }

  // Actualiza el estatus del proyecto y refleja el cambio localmente (optimista)
  // Si el nuevo estatus es ID=3 (Terminado), también guarda la fecha de hoy como fecha fin
  const handleUpdateStatus = async () => {
    if (!selectedProject) return
    setUpdatingStatus(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${selectedProject.Pro_ID_Proyecto}/estatus`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ estadoId: detailsStatusId })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al actualizar estado')
      }

      const numId = Number(detailsStatusId)
      setProjects(prev => prev.map(p => {
        if (p.Pro_ID_Proyecto === selectedProject.Pro_ID_Proyecto) {
          const today = new Date().toISOString().slice(0, 10)
          return {
            ...p,
            Epr_ID_Estatus_Proyecto: numId,
            Pro_Fecha_Finalizacion: numId === 3 ? today : p.Pro_Fecha_Finalizacion
          }
        }
        return p
      }))
      setShowDetailsModal(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar estatus')
    } finally {
      setUpdatingStatus(false)
    }
  }

  // Agrega un usuario al equipo del proyecto (actualización optimista en la lista local)
  const handleAssignUser = async () => {
    if (!selectedProject || !selectedUserId) return
    setError('')
    try {
      const res = await fetch(`/api/projects/${selectedProject.Pro_ID_Proyecto}/usuarios`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ usuId: selectedUserId })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al asignar usuario')
      }

      const userObj = allUsers.find(u => u.id.toString() === selectedUserId)
      if (userObj) {
        setProjectUsers(prev => [...prev, userObj])
      }
      setSelectedUserId('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al asignar usuario')
    }
  }

  // Quita un usuario del equipo del proyecto (actualiza la lista local filtrando por ID)
  const handleRemoveUser = async (usuId: number) => {
    if (!selectedProject) return
    try {
      const res = await fetch(`/api/projects/${selectedProject.Pro_ID_Proyecto}/usuarios/${usuId}`, {
        method: 'DELETE',
        headers
      })
      if (!res.ok) throw new Error('Error al remover usuario')
      setProjectUsers(prev => prev.filter(u => u.id !== usuId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al remover usuario')
    }
  }

  // Activa el modo edición en el modal de detalle y pre-carga el formulario con datos actuales
  const openEditMode = () => {
    if (!selectedProject) return
    setEditForm({
      nombre: selectedProject.Pro_Nombre,
      descripcion: selectedProject.Pro_Descripcion || '',
      fechaInicio: selectedProject.Pro_Fecha_Inicio?.slice(0, 10) || '',
      fechaFin: selectedProject.Pro_Fecha_Finalizacion?.slice(0, 10) || '',
      costo: selectedProject.Pro_Costo_Proyecto?.toString() || '',
      estadoId: selectedProject.Epr_ID_Estatus_Proyecto?.toString() || '1'
    })
    setError('')
    setEditMode(true)
  }

  // Guarda los cambios del formulario de edición (PUT al servidor + actualización optimista en la lista)
  const handleSaveEdit = async () => {
    if (!selectedProject || !editForm.nombre.trim()) { setError('El nombre es requerido'); return }
    if (editForm.fechaInicio && editForm.fechaFin && new Date(editForm.fechaFin) < new Date(editForm.fechaInicio)) {
      setError('La fecha de fin no puede ser anterior a la de inicio'); return
    }
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/projects/${selectedProject.Pro_ID_Proyecto}`, {
        method: 'PUT', headers,
        body: JSON.stringify({
          nombre: editForm.nombre.trim(),
          descripcion: editForm.descripcion || null,
          fechaInicio: editForm.fechaInicio || null,
          fechaFin: editForm.fechaFin || null,
          costo: editForm.costo ? Number(editForm.costo) : null,
          estadoId: Number(editForm.estadoId)
        })
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      const estadoNombre = estados.find(e => e.id === Number(editForm.estadoId))?.nombre || null
      setProjects(prev => prev.map(p => p.Pro_ID_Proyecto === selectedProject.Pro_ID_Proyecto
        ? { ...p, Pro_Nombre: editForm.nombre.trim(), Pro_Descripcion: editForm.descripcion || null,
            Pro_Fecha_Inicio: editForm.fechaInicio, Pro_Fecha_Finalizacion: editForm.fechaFin || null,
            Pro_Costo_Proyecto: editForm.costo ? Number(editForm.costo) : null,
            Epr_ID_Estatus_Proyecto: Number(editForm.estadoId), estado: estadoNombre }
        : p))
      setSelectedProject(prev => prev ? { ...prev, Pro_Nombre: editForm.nombre.trim(),
        Pro_Descripcion: editForm.descripcion || null, Pro_Fecha_Inicio: editForm.fechaInicio,
        Pro_Fecha_Finalizacion: editForm.fechaFin || null,
        Pro_Costo_Proyecto: editForm.costo ? Number(editForm.costo) : null,
        Epr_ID_Estatus_Proyecto: Number(editForm.estadoId) } : null)
      setEditMode(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al guardar') }
    finally { setSaving(false) }
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
                  <div key={proj.Pro_ID_Proyecto} className="kanban-card" onClick={() => handleOpenDetails(proj)} style={{ cursor: 'pointer' }} title="Clic para ver detalles">
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
            <h3>Nuevo proyecto</h3>
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
              <button type="button" className="action-btn primary" onClick={handleCreate} disabled={saving}>
                {saving ? 'Guardando...' : 'Crear proyecto'}
              </button>
              <button type="button" className="action-btn secondary" onClick={() => !saving && setShowModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && selectedProject && (
        <div className="modal-overlay" onClick={() => !updatingStatus && !saving && setShowDetailsModal(false)}>
          <div className="modal-container projects-modal" onClick={e => e.stopPropagation()}>
            <button type="button" className="modal-close-btn" onClick={() => !updatingStatus && !saving && setShowDetailsModal(false)} aria-label="Cerrar">×</button>
            <h3>{editMode ? 'Editar Proyecto' : 'Detalles del Proyecto'}</h3>
            {error && <div className="form-error" style={{ color: 'var(--error)', marginBottom: 12 }}>{error}</div>}

            {editMode ? (
              <>
                <div className="form-group">
                  <label>Nombre *</label>
                  <input className="modal-input" value={editForm.nombre} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Descripción</label>
                  <textarea className="modal-input" rows={3} style={{ resize: 'none' }} value={editForm.descripcion} onChange={e => setEditForm(f => ({ ...f, descripcion: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <select className="modal-input" value={editForm.estadoId} onChange={e => setEditForm(f => ({ ...f, estadoId: e.target.value }))}>
                    {estados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Fecha inicio</label>
                    <input type="date" className="modal-input" value={editForm.fechaInicio} onChange={e => setEditForm(f => ({ ...f, fechaInicio: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Fecha fin</label>
                    <input type="date" className="modal-input" value={editForm.fechaFin} onChange={e => setEditForm(f => ({ ...f, fechaFin: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Costo (MXN)</label>
                  <input type="number" className="modal-input" value={editForm.costo} onChange={e => setEditForm(f => ({ ...f, costo: e.target.value }))} placeholder="Opcional" />
                </div>
                <div className="modal-actions">
                  <button type="button" className="action-btn primary" onClick={handleSaveEdit} disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                  <button type="button" className="action-btn secondary" onClick={() => { setEditMode(false); setError('') }}>Cancelar</button>
                </div>
              </>
            ) : (
              <>
                <div className="project-details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Nombre:</span>
                    <span className="detail-value">{selectedProject.Pro_Nombre}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Descripción:</span>
                    <span className="detail-value">{selectedProject.Pro_Descripcion || 'Sin descripción'}</span>
                  </div>
                  <div className="form-row">
                    <div className="detail-item">
                      <span className="detail-label">Fecha de Inicio:</span>
                      <span className="detail-value">{formatDate(selectedProject.Pro_Fecha_Inicio)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Fecha de Fin:</span>
                      <span className="detail-value">{formatDate(selectedProject.Pro_Fecha_Finalizacion)}</span>
                    </div>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Costo:</span>
                    <span className="detail-value">{formatMoney(selectedProject.Pro_Costo_Proyecto)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Dirección:</span>
                    <span className="detail-value">{selectedProject.direccionCompleta || 'Sin dirección asignada'}</span>
                  </div>
                </div>

                <hr style={{ margin: '20px 0', borderColor: 'var(--border)' }} />

                <div className="project-users-section">
                  <h4>Usuarios Asignados</h4>
                  {usersLoading ? (
                    <div className="text-sm text-muted">Cargando usuarios...</div>
                  ) : projectUsers.length === 0 ? (
                    <div className="text-sm text-muted">No hay usuarios asignados a este proyecto.</div>
                  ) : (
                    <ul className="user-list">
                      {projectUsers.map(u => (
                        <li key={u.id}>
                          <span>{u.nombre} {u.apellido} <small>({u.correo})</small></span>
                          <button type="button" className="remove-user-btn" onClick={() => handleRemoveUser(u.id)} title="Remover usuario">×</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="assign-user-box">
                    <select className="modal-input" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
                      <option value="">Seleccionar usuario...</option>
                      {allUsers.filter(u => !projectUsers.some(pu => pu.id === u.id)).map(u => (
                        <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>
                      ))}
                    </select>
                    <button type="button" className="action-btn primary small" onClick={handleAssignUser} disabled={!selectedUserId}>Asignar</button>
                  </div>
                </div>

                <hr style={{ margin: '20px 0', borderColor: 'var(--border)' }} />

                <div className="form-group">
                  <label>Actualizar Estatus</label>
                  <select className="modal-input" value={detailsStatusId} onChange={e => setDetailsStatusId(e.target.value)}>
                    {estados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>

                <div className="modal-actions">
                  <button type="button" className="action-btn primary" onClick={handleUpdateStatus} disabled={updatingStatus}>
                    {updatingStatus ? 'Actualizando...' : 'Guardar Estatus'}
                  </button>
                  <button type="button" className="action-btn secondary" onClick={openEditMode}>Editar Proyecto</button>
                  <button type="button" className="action-btn secondary" onClick={() => setShowDetailsModal(false)}>Cerrar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        .projects-toolbar { margin-bottom: 20px; }
        .projects-loading { padding: 40px; text-align: center; color: var(--text-muted); }
        .kanban-card { transition: transform 0.2s, box-shadow 0.2s; }
        .kanban-card:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .kanban-card-meta { font-size: 0.8rem; color: var(--text-muted); margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px; }
        .projects-modal .form-row { display: flex; gap: 16px; }
        .projects-modal .form-row .form-group { flex: 1; }
        .projects-modal .modal-actions { display: flex; gap: 12px; margin-top: 20px; }
        .project-details-grid { display: flex; flex-direction: column; gap: 16px; }
        .detail-item { display: flex; flex-direction: column; flex: 1; }
        .detail-label { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; text-transform: uppercase; }
        .detail-value { font-size: 1rem; color: var(--text-main); margin-top: 2px; }
        .project-users-section { margin-bottom: 20px; }
        .project-users-section h4 { margin-bottom: 12px; font-size: 1rem; color: var(--text-main); }
        .user-list { list-style: none; padding: 0; margin: 0 0 12px 0; }
        .user-list li { display: flex; justify-content: space-between; align-items: center; padding: 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; margin-bottom: 8px; font-size: 0.9rem; }
        .remove-user-btn { background: none; border: none; color: var(--error); font-size: 1.2rem; cursor: pointer; padding: 0 4px; }
        .remove-user-btn:hover { color: red; }
        .assign-user-box { display: flex; gap: 8px; }
        .assign-user-box select { flex: 1; }
        .action-btn.small { padding: 8px 16px; font-size: 0.9rem; }
        .text-sm { font-size: 0.9rem; }
        .text-muted { color: var(--text-muted); }
      `}</style>
    </div>
  )
}
