// ============================================================
// MÓDULO: Usuarios
// Gestión de los usuarios del sistema SAPRO (alta, edición,
// eliminación y cambio de estatus activo/inactivo).
// Cada usuario tiene una entrada en la tabla Usuario y otra
// en Login para el acceso con correo y contraseña.
// ============================================================

import { useState, useEffect } from 'react'

// ── Interfaces ───────────────────────────────────────────────
// Representa un usuario del sistema con su perfil y estado de acceso
interface Usuario {
  id: number
  nombre: string
  apellido: string
  puesto: string      // Puesto o cargo dentro de la empresa
  telefono: string
  correo: string
  activo: boolean     // false = no puede iniciar sesión
}

interface UsersProps { token: string }

// Valores por defecto del formulario de usuario
// activo: true para que el nuevo usuario tenga acceso desde el inicio
const emptyForm = {
  nombre: '', apellido: '', puesto: '', telefono: '', correo: '', contrasena: '', activo: true
}

export default function Users({ token }: UsersProps) {

  // ── Estado: datos ────────────────────────────────────────
  const [usuarios, setUsuarios]     = useState<Usuario[]>([])
  const [loading, setLoading]       = useState(true)

  // ── Estado: modal de crear/editar ────────────────────────
  const [showModal, setShowModal]   = useState(false)
  const [editTarget, setEditTarget] = useState<Usuario | null>(null) // null = modo crear
  const [form, setForm]             = useState(emptyForm)
  const [showPass, setShowPass]     = useState(false)  // toggle visibilidad contraseña
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  // ── Estado: modal de eliminar ────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Usuario | null>(null)
  const [deleting, setDeleting]     = useState(false)

  // Toast de notificación
  const [notif, setNotif]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Headers para peticiones autenticadas
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Muestra un toast por 3 segundos
  const showNotif = (msg: string, type: 'success' | 'error' = 'success') => {
    setNotif({ msg, type })
    setTimeout(() => setNotif(null), 3000)
  }

  // ── GET /api/usuarios — Carga la lista de usuarios ──────
  const fetchUsuarios = async () => {
    try {
      const res = await fetch('/api/usuarios', { headers })
      if (res.ok) setUsuarios(await res.json())
    } catch { /* ignorar errores de red */ } finally { setLoading(false) }
  }

  // Carga inicial al montar el componente
  useEffect(() => { fetchUsuarios() }, [])

  // ── Abre el modal en modo CREAR ──────────────────────────
  const openCreate = () => {
    setEditTarget(null)          // null = creando, no editando
    setForm(emptyForm)
    setShowPass(false)
    setError('')
    setShowModal(true)
  }

  // ── Abre el modal en modo EDITAR con los datos del usuario ─
  const openEdit = (u: Usuario) => {
    setEditTarget(u)
    setForm({
      nombre: u.nombre, apellido: u.apellido, puesto: u.puesto,
      telefono: u.telefono, correo: u.correo,
      contrasena: '',   // vacío = no cambiar contraseña
      activo: u.activo
    })
    setShowPass(false)
    setError('')
    setShowModal(true)
  }

  // ── POST /api/usuarios (crear) o PUT /api/usuarios/:id (editar) ─
  const handleSave = async () => {
    // Validación de campos obligatorios
    if (!form.nombre || !form.apellido || !form.puesto || !form.telefono || !form.correo) {
      setError('Todos los campos son requeridos')
      return
    }
    // Contraseña requerida solo al crear; en edición es opcional
    if (!editTarget && !form.contrasena) {
      setError('La contraseña es requerida para un nuevo usuario')
      return
    }
    setSaving(true); setError('')
    try {
      const body: Record<string, unknown> = {
        nombre: form.nombre, apellido: form.apellido, puesto: form.puesto,
        telefono: form.telefono, correo: form.correo, activo: form.activo
      }
      // Solo incluir contraseña en el body si se llenó el campo
      if (form.contrasena) body.contrasena = form.contrasena

      const res = editTarget
        ? await fetch(`/api/usuarios/${editTarget.id}`, { method: 'PUT', headers, body: JSON.stringify(body) })
        : await fetch('/api/usuarios',                  { method: 'POST', headers, body: JSON.stringify(body) })

      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      await fetchUsuarios()   // Recargar lista
      setShowModal(false)
      showNotif(editTarget ? 'Usuario actualizado' : 'Usuario creado')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setSaving(false) }
  }

  // ── DELETE /api/usuarios/:id — Elimina usuario y su login ─
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/usuarios/${deleteTarget.id}`, { method: 'DELETE', headers })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      await fetchUsuarios()
      setDeleteTarget(null)
      showNotif('Usuario eliminado')
    } catch (e) {
      showNotif(e instanceof Error ? e.message : 'Error al eliminar', 'error')
    } finally { setDeleting(false) }
  }

  // ── PUT /api/usuarios/:id — Alterna activo/inactivo sin abrir modal ─
  // Envía todos los campos actuales + el flag activo invertido
  const toggleActivo = async (u: Usuario) => {
    try {
      const res = await fetch(`/api/usuarios/${u.id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({
          nombre: u.nombre, apellido: u.apellido, puesto: u.puesto,
          telefono: u.telefono, correo: u.correo,
          activo: !u.activo   // invertir el estado actual
        })
      })
      if (res.ok) {
        // Actualización optimista: no recargar toda la tabla
        setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, activo: !u.activo } : x))
        showNotif(`Usuario ${!u.activo ? 'activado' : 'desactivado'}`)
      }
    } catch { showNotif('Error al cambiar estatus', 'error') }
  }

  // ── RENDER ───────────────────────────────────────────────
  return (
    <div className="fade-in">
      {/* Toast de notificación */}
      {notif && <div className={`notification ${notif.type}`}>{notif.type === 'success' ? '✅' : '❌'} {notif.msg}</div>}

      {/* Barra superior: conteo y botón de nuevo usuario */}
      <div className="ing-toolbar" style={{ marginBottom: 20 }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} registrado{usuarios.length !== 1 ? 's' : ''}
        </div>
        <button className="action-btn primary" onClick={openCreate}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuevo Usuario
        </button>
      </div>

      {/* Tabla de usuarios */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando usuarios...</div>
      ) : usuarios.length === 0 ? (
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <h3>No hay usuarios registrados</h3>
          <p>Haz clic en "Nuevo Usuario" para agregar uno</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Puesto</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Estatus</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} className="fade-in">
                  {/* Avatar con iniciales + nombre completo */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Círculo de avatar con iniciales nombre + apellido */}
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: '#2563eb', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.85rem', flexShrink: 0
                      }}>
                        {u.nombre.charAt(0)}{u.apellido.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{u.nombre} {u.apellido}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.875rem' }}>{u.puesto}</td>
                  <td style={{ fontSize: '0.875rem' }}>{u.telefono}</td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{u.correo}</td>
                  <td>
                    {/* Badge clickeable para activar/desactivar sin abrir modal */}
                    <button
                      className={`estatus-select ${u.activo ? 'badge-active' : 'badge-error'}`}
                      onClick={() => toggleActivo(u)}
                      title="Clic para cambiar estatus"
                    >
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td>
                    <div className="action-cell">
                      {/* Editar usuario */}
                      <button className="icon-btn edit" onClick={() => openEdit(u)} title="Editar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        <span className="btn-label">Editar</span>
                      </button>
                      {/* Eliminar usuario (requiere confirmación) */}
                      <button className="icon-btn delete" onClick={() => setDeleteTarget(u)} title="Eliminar">
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

      {/* ── Modal: Crear / Editar usuario ─────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-card fade-in" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h3>{editTarget ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
            {error && <div style={{ color: 'var(--error)', marginBottom: 12, fontSize: '0.875rem' }}>{error}</div>}
            <div className="form-grid">
              {/* Nombre */}
              <div className="form-group">
                <label>Nombre <span style={{ color: 'var(--error)' }}>*</span></label>
                <input className="modal-input" type="text" placeholder="ej. Juan"
                  value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              {/* Apellido */}
              <div className="form-group">
                <label>Apellido <span style={{ color: 'var(--error)' }}>*</span></label>
                <input className="modal-input" type="text" placeholder="ej. García"
                  value={form.apellido} onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))} />
              </div>
              {/* Puesto (ocupa todo el ancho) */}
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Puesto Principal <span style={{ color: 'var(--error)' }}>*</span></label>
                <input className="modal-input" type="text" placeholder="ej. Técnico de Soporte"
                  value={form.puesto} onChange={e => setForm(f => ({ ...f, puesto: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Teléfono <span style={{ color: 'var(--error)' }}>*</span></label>
                <input className="modal-input" type="text" placeholder="ej. 6441234567"
                  value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Correo <span style={{ color: 'var(--error)' }}>*</span></label>
                <input className="modal-input" type="email" placeholder="ej. juan@cits.mx"
                  value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))} />
              </div>
              {/* Campo de contraseña con botón de visibilidad */}
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>
                  {editTarget ? 'Nueva Contraseña' : 'Contraseña'}
                  {/* En edición: avisar que vacío = sin cambios */}
                  {editTarget && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: 6 }}>(dejar vacío para no cambiar)</span>}
                  {!editTarget && <span style={{ color: 'var(--error)' }}> *</span>}
                </label>
                <div style={{ position: 'relative' }}>
                  <input className="modal-input" type={showPass ? 'text' : 'password'}
                    placeholder={editTarget ? 'Nueva contraseña (opcional)' : 'Contraseña de acceso'}
                    value={form.contrasena} onChange={e => setForm(f => ({ ...f, contrasena: e.target.value }))}
                    style={{ paddingRight: 40 }} />
                  {/* Botón para mostrar/ocultar contraseña */}
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    {showPass
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>
              {/* Checkbox de activo/inactivo — solo en modo editar */}
              {editTarget && (
                <div className="form-group" style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="activoCheck" checked={form.activo}
                    onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
                  <label htmlFor="activoCheck" style={{ marginBottom: 0, cursor: 'pointer' }}>Usuario activo</label>
                </div>
              )}
            </div>
            <div className="modal-actions" style={{ marginTop: 20, display: 'flex', gap: 12 }}>
              <button className="action-btn primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : editTarget ? 'Guardar Cambios' : 'Crear Usuario'}
              </button>
              <button className="action-btn secondary" onClick={() => !saving && setShowModal(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirmar eliminación ──────────────────── */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="modal-card fade-in" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3>Eliminar Usuario</h3>
            {/* Nombre completo del usuario a eliminar */}
            <p style={{ color: 'var(--text-muted)', margin: '12px 0 20px' }}>
              ¿Estás seguro de que deseas eliminar a <strong>{deleteTarget.nombre} {deleteTarget.apellido}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="modal-actions" style={{ display: 'flex', gap: 12 }}>
              <button className="action-btn" style={{ background: 'var(--error)', color: '#fff' }} onClick={handleDelete} disabled={deleting}>
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
