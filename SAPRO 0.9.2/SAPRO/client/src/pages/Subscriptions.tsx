// ============================================================
// MÓDULO: Subscriptions (Suscripciones)
// Descripción: Gestión completa de suscripciones de clientes:
//   crear, editar, renovar, ver detalle y administrar correos
//   de contacto asociados a cada suscripción.
// Rutas API utilizadas:
//   GET  /api/subscriptions              → listar suscripciones
//   POST /api/subscriptions              → crear suscripción
//   PUT  /api/subscriptions/:id          → editar suscripción
//   PUT  /api/subscriptions/:id/renovar  → renovar (pone estatus Activa)
//   POST /api/subscriptions/verificar-vencimientos → marcar vencidas
//   GET  /api/subscriptions/tipos        → tipos de plan
//   GET  /api/subscriptions/estatus      → catálogo de estatus
//   GET  /api/subscriptions/:id/correos  → correos de contacto
//   POST /api/subscriptions/:id/correos  → agregar correo
//   PUT  /api/subscriptions/:id/correos/:cid/principal → marcar principal
//   DELETE /api/subscriptions/correos/:cid → borrar correo
//   GET  /api/clientes                   → dropdown de clientes al crear
// Nota: Si la API de tipos/estatus falla, se usan los DEFAULT_TIPOS
//   y DEFAULT_ESTATUS como fallback para no bloquear la UI.
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { Plus, X, RefreshCw, Search, Eye, Pencil, Mail, Star, Trash2, CreditCard, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { useRecentActivity } from '../context/RecentActivityContext'

// ─── Interfaces ───────────────────────────────────────────────────────────────

// Suscripción tal como llega del servidor (campos del join con cliente, plan, etc.)
interface SubscriptionEntry {
    id: string
    clienteId: number
    cliente: string          // nombre del cliente (join)
    plan: string             // nombre del tipo de suscripción (join)
    duracionDias: number     // duración del plan en días
    precioPlan: number       // precio oficial del plan
    fechaSuscripcion: string
    montoPagado: number      // puede diferir del precio (descuento/negociación)
    estatus: string          // nombre del estatus (ej. "Activa", "Vencida")
}

// Plan de suscripción del catálogo (ej. Mensual, Anual)
interface TipoSuscripcion {
    id: number
    nombre: string
    duracion_dias: number
    precio: number
}

// Estatus posible de una suscripción
interface EstatusSuscripcion {
    id: number
    nombre: string
}

// Correo de contacto asociado a una suscripción (puede haber varios)
interface CorreoEntry {
    id: number
    susId: number
    correo: string
    nombre: string | null    // nombre del contacto (opcional)
    principal: boolean       // true = correo principal de la suscripción
    fecha: string
}

// Item de cliente para el select al crear suscripción
interface ClienteItem {
    id: number
    nombre: string
}

interface SubscriptionsProps {
    token?: string
}

// ─── Mini Date Picker ─────────────────────────────────────────────────────────
// Componente de calendario personalizado que reemplaza <input type="date">
// Muestra un popup con navegación mes/año, días de la semana en español,
// y resalta el día de hoy y el día seleccionado.
// Props: value = "YYYY-MM-DD" string | ""    onChange = callback con nuevo "YYYY-MM-DD"

const DAYS_ES   = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']   // encabezados de columna
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function MiniDatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null) // detectar clic fuera para cerrar

    // Parsea con T00:00:00 para evitar desfases de timezone (UTC vs local)
    const parsed = value ? new Date(value + 'T00:00:00') : new Date()
    const [viewYear,  setViewYear]  = useState(parsed.getFullYear())
    const [viewMonth, setViewMonth] = useState(parsed.getMonth())

    // Listener global: cierra el calendario al hacer clic fuera del componente
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const today = new Date(); today.setHours(0,0,0,0) // sin hora para comparar solo fechas
    const selected = value ? new Date(value + 'T00:00:00') : null

    // firstDay = día de semana (0=Dom) del día 1 del mes actual (determina celdas vacías)
    const firstDay    = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate() // día 0 del mes siguiente = último del actual

    const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y-1); setViewMonth(11) } else setViewMonth(m => m-1) }
    const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y+1); setViewMonth(0) } else setViewMonth(m => m+1) }

    // Construye el string "YYYY-MM-DD" y llama al callback del padre
    const selectDay = (d: number) => {
        const mm = String(viewMonth + 1).padStart(2, '0')
        const dd = String(d).padStart(2, '0')
        onChange(`${viewYear}-${mm}-${dd}`)
        setOpen(false)
    }

    const displayValue = selected
        ? selected.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'Seleccionar fecha'

    // Rellena celdas vacías al inicio (para alinear el día 1 con su día de semana correcto)
    const cells: (number | null)[] = Array(firstDay).fill(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <div
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 8,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-input, var(--bg-card))',
                    cursor: 'pointer', fontSize: '0.9rem',
                    color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
                    userSelect: 'none',
                }}
            >
                <span>{displayValue}</span>
                <Calendar size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }}/>
            </div>
            {open && (
                <div style={{
                    position: 'absolute', zIndex: 9999, top: 'calc(100% + 6px)', left: 0,
                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                    padding: 14, minWidth: 260,
                }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }}>
                            <ChevronLeft size={16}/>
                        </button>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                            {MONTHS_ES[viewMonth]} {viewYear}
                        </span>
                        <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }}>
                            <ChevronRight size={16}/>
                        </button>
                    </div>
                    {/* Day headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                        {DAYS_ES.map(d => (
                            <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', padding: '2px 0' }}>{d}</div>
                        ))}
                    </div>
                    {/* Day cells */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                        {cells.map((d, i) => {
                            if (!d) return <div key={`e${i}`}/>
                            const thisDate = new Date(viewYear, viewMonth, d)
                            const isToday = thisDate.getTime() === today.getTime()
                            const isSel   = selected && thisDate.getTime() === selected.getTime()
                            return (
                                <button
                                    key={d}
                                    onClick={() => selectDay(d)}
                                    style={{
                                        border: 'none', borderRadius: 6, cursor: 'pointer',
                                        padding: '6px 2px', fontSize: '0.82rem', fontWeight: isSel ? 700 : 400,
                                        background: isSel ? 'var(--accent-primary)' : isToday ? 'rgba(99,102,241,0.12)' : 'transparent',
                                        color: isSel ? '#fff' : isToday ? 'var(--accent-primary)' : 'var(--text-primary)',
                                        outline: isToday && !isSel ? '1px solid var(--accent-primary)' : 'none',
                                    }}
                                >
                                    {d}
                                </button>
                            )
                        })}
                    </div>
                    {/* Today shortcut */}
                    <div style={{ marginTop: 10, textAlign: 'center' }}>
                        <button onClick={() => {
                            const t = new Date()
                            setViewYear(t.getFullYear()); setViewMonth(t.getMonth())
                            selectDay(t.getDate())
                        }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--accent-primary)', textDecoration: 'underline' }}>
                            Hoy
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Formatea número como moneda MXN (ej. $2,500.00)
const fmt = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

// Formatea fecha ISO a "DD MMM AAAA" en español (ej. "01 ene 2025")
const fdate = (d: string) =>
    d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'

// Mapeo de nombre de estatus → clases CSS del badge
const ESTATUS_BADGE: Record<string, string> = {
    'Activa':      'badge badge-green',
    'Vencida':     'badge badge-red',
    'Cancelada':   'badge',
    'En revisión': 'badge badge-orange',
    'Suspendida':  'badge badge-purple',
}

// ─── Datos por defecto (siempre visibles aunque la API falle) ─────────────────
// Si el endpoint de tipos/estatus devuelve error, estos valores aseguran
// que el formulario funcione sin que el usuario vea una lista vacía.

const DEFAULT_TIPOS: TipoSuscripcion[] = [
    { id: 1, nombre: 'Mensual',    duracion_dias: 30,  precio: 2500.00  },
    { id: 2, nombre: 'Trimestral', duracion_dias: 90,  precio: 6500.00  },
    { id: 3, nombre: 'Semestral',  duracion_dias: 180, precio: 11000.00 },
    { id: 4, nombre: 'Anual',      duracion_dias: 365, precio: 19500.00 },
    { id: 5, nombre: 'Bianual',    duracion_dias: 730, precio: 34000.00 },
]

const DEFAULT_ESTATUS: EstatusSuscripcion[] = [
    { id: 1, nombre: 'Activa'      },
    { id: 2, nombre: 'Vencida'     },
    { id: 3, nombre: 'Cancelada'   },
    { id: 4, nombre: 'En revisión' },
    { id: 5, nombre: 'Suspendida'  },
]

// ─── Componente principal ──────────────────────────────────────────────────────

export default function Subscriptions({ token }: SubscriptionsProps) {

    // ── Estado: datos principales ──────────────────────────
    const [subscriptions, setSubscriptions] = useState<SubscriptionEntry[]>([])
    const [tipos,         setTipos]         = useState<TipoSuscripcion[]>(DEFAULT_TIPOS)       // fallback a DEFAULT_TIPOS
    const [estatusList,   setEstatusList]   = useState<EstatusSuscripcion[]>(DEFAULT_ESTATUS)  // fallback a DEFAULT_ESTATUS
    const [clientes,      setClientes]      = useState<ClienteItem[]>([])
    const [loading,       setLoading]       = useState(false)
    const [notif,         setNotif]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

    // ── Estado: filtros de la tabla ───────────────────────
    const [searchTerm,    setSearchTerm]    = useState('')     // búsqueda por nombre de cliente o plan
    const [filterPlan,    setFilterPlan]    = useState('')     // filtro por nombre de plan
    const [filterEstatus, setFilterEstatus] = useState('')     // filtro por estatus

    // ── Estado: modales ───────────────────────────────────
    // 'create' | 'edit' | 'view' | 'renovar' | 'correos' | null
    type ModalType = 'create' | 'edit' | 'view' | 'renovar' | 'correos' | null
    const [modal,   setModal]   = useState<ModalType>(null)
    const [selSub,  setSelSub]  = useState<SubscriptionEntry | null>(null) // suscripción activa en el modal

    // ── Estado: formulario de suscripción (crear/editar/renovar) ──
    const [fClienteId, setFClienteId] = useState<number | ''>('')
    const [fTipoId,    setFTipoId]    = useState<number | ''>('')  // ID del plan seleccionado
    const [fMonto,     setFMonto]     = useState<number | ''>('')  // se pre-llena con el precio del plan
    const [fFecha,     setFFecha]     = useState(new Date().toISOString().slice(0, 10)) // fecha de hoy
    const [fEstatusId, setFEstatusId] = useState<number | ''>('')
    const [fError,     setFError]     = useState('')
    const [fSaving,    setFSaving]    = useState(false)

    // ── Estado: correos de contacto (modal 'correos') ─────
    const [correos,        setCorreos]        = useState<CorreoEntry[]>([])
    const [correosLoading, setCorreosLoading] = useState(false)
    const [cCorreo,        setCCorreo]        = useState('')
    const [cNombre,        setCNombre]        = useState('')
    const [cPrincipal,     setCPrincipal]     = useState(false) // checkbox "marcar como principal"
    const [cError,         setCError]         = useState('')
    const [cSaving,        setCSaving]        = useState(false)

    const [checkingVenc, setCheckingVenc] = useState(false) // spinner del botón "Verificar Vencimientos"

    const { addActivity } = useRecentActivity() // registra eventos en el feed de actividad reciente
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

    // ── Verificar vencimientos: llama al servidor para marcar como "Vencida"
    // las suscripciones cuya fecha + duración ya expiró
    const verificarVencimientos = async () => {
        if (!token) return
        setCheckingVenc(true)
        try {
            const res = await fetch('/api/subscriptions/verificar-vencimientos', { method: 'POST', headers })
            if (res.ok) {
                const d = await res.json()
                showNotif(d.mensaje, d.vencidas > 0 ? 'success' : 'success')
                // Recarga la lista solo si hubo cambios
                if (d.vencidas > 0) await fetchAll()
            }
        } catch { showNotif('Error al verificar vencimientos', 'error') }
        finally { setCheckingVenc(false) }
    }

    // Muestra notificación flotante por 3 segundos
    const showNotif = (msg: string, type: 'success' | 'error' = 'success') => {
        setNotif({ msg, type })
        setTimeout(() => setNotif(null), 3000)
    }

    // ── Carga todos los datos en paralelo (4 requests simultáneos) ──
    const fetchAll = async () => {
        if (!token) return
        setLoading(true)
        try {
            const [r1, r2, r3, r4] = await Promise.all([
                fetch('/api/subscriptions',         { headers }),
                fetch('/api/subscriptions/tipos',   { headers }),
                fetch('/api/subscriptions/estatus', { headers }),
                fetch('/api/clientes',              { headers }),
            ])
            if (r1.ok) setSubscriptions(await r1.json())
            if (r2.ok) { const d = await r2.json(); if (Array.isArray(d) && d.length > 0) setTipos(d) }
            if (r3.ok) { const d = await r3.json(); if (Array.isArray(d) && d.length > 0) setEstatusList(d) }
            if (r4.ok) { const d = await r4.json(); if (Array.isArray(d)) setClientes(d) }
        } catch { /* ignore */ }
        finally { setLoading(false) }
    }

    useEffect(() => { fetchAll() }, [token])

    const fetchCorreos = async (susId: string) => {
        setCorreosLoading(true)
        try {
            const res = await fetch(`/api/subscriptions/${susId}/correos`, { headers })
            if (res.ok) setCorreos(await res.json())
        } catch { /* ignore */ }
        finally { setCorreosLoading(false) }
    }

    const handleAddCorreo = async () => {
        if (!cCorreo.trim()) { setCError('El correo es requerido.'); return }
        if (!selSub) return
        setCSaving(true); setCError('')
        try {
            const res = await fetch(`/api/subscriptions/${selSub.id}/correos`, {
                method: 'POST', headers,
                body: JSON.stringify({ correo: cCorreo, nombre: cNombre, principal: cPrincipal }),
            })
            if (!res.ok) {
                const d = await res.json().catch(() => ({}))
                setCError(d.error || 'Error al agregar.'); return
            }
            setCCorreo(''); setCNombre(''); setCPrincipal(false)
            await fetchCorreos(selSub.id)
            showNotif('Correo agregado')
        } catch { setCError('Error de conexión.') }
        finally { setCSaving(false) }
    }

    const handleSetPrincipal = async (correoId: number) => {
        if (!selSub) return
        await fetch(`/api/subscriptions/${selSub.id}/correos/${correoId}/principal`, { method: 'PUT', headers })
        await fetchCorreos(selSub.id)
        showNotif('Correo principal actualizado')
    }

    const handleDeleteCorreo = async (correoId: number) => {
        await fetch(`/api/subscriptions/correos/${correoId}`, { method: 'DELETE', headers })
        if (selSub) await fetchCorreos(selSub.id)
        showNotif('Correo eliminado')
    }

    const resetForm = () => {
        setFClienteId(''); setFTipoId(''); setFMonto('')
        setFFecha(new Date().toISOString().slice(0, 10))
        setFEstatusId(''); setFError('')
    }

    // ── Apertura de modales ──────────────────────────────────
    const openCreate  = () => { resetForm(); setSelSub(null); setModal('create') }
    const openView    = (s: SubscriptionEntry) => { setSelSub(s); setModal('view') }

    // Pre-carga el formulario con datos actuales de la suscripción
    const openEdit    = (s: SubscriptionEntry) => {
        setSelSub(s)
        const t = tipos.find(t => t.nombre === s.plan)      // busca el ID del plan por nombre
        const e = estatusList.find(e => e.nombre === s.estatus) // busca el ID del estatus por nombre
        setFTipoId(t?.id ?? ''); setFMonto(s.montoPagado)
        setFFecha(s.fechaSuscripcion?.slice(0, 10) ?? '')
        setFEstatusId(e?.id ?? ''); setFError(''); setModal('edit')
    }

    // Pre-carga con el precio del plan actual y la fecha de hoy
    const openRenovar = (s: SubscriptionEntry) => {
        setSelSub(s)
        const t = tipos.find(t => t.nombre === s.plan)
        setFTipoId(t?.id ?? ''); setFMonto(s.precioPlan)
        setFFecha(new Date().toISOString().slice(0, 10))    // fecha de hoy como nueva fecha de inicio
        setFError(''); setModal('renovar')
    }

    // Abre modal de correos Y dispara la carga de los correos de esa suscripción
    const openCorreos = (s: SubscriptionEntry) => {
        setSelSub(s)
        setCCorreo(''); setCNombre(''); setCPrincipal(false); setCError('')
        setModal('correos')
        fetchCorreos(s.id)
    }

    const closeModal = () => { setModal(null); setSelSub(null) }

    const handleCreate = async () => {
        if (!fClienteId || !fTipoId || !fMonto || !fFecha) {
            setFError('Completa todos los campos obligatorios.'); return
        }
        setFSaving(true); setFError('')
        try {
            const res = await fetch('/api/subscriptions', {
                method: 'POST', headers,
                body: JSON.stringify({ clienteId: fClienteId, tipoId: fTipoId, montoPagado: fMonto, fecha: fFecha, estatusId: fEstatusId || 1 }),
            })
            if (!res.ok) { const d = await res.json().catch(() => ({})); setFError(d.error || 'Error al crear.'); return }
            const n: SubscriptionEntry = await res.json()
            addActivity({ user: 'Tú', action: 'creaste suscripción para', target: n.cliente, iconType: 'file', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' })
            showNotif('Suscripción creada exitosamente')
            await fetchAll(); closeModal()
        } catch { setFError('Error de conexión.') }
        finally { setFSaving(false) }
    }

    const handleEdit = async () => {
        if (!selSub || !fTipoId || !fMonto || !fFecha || !fEstatusId) {
            setFError('Completa todos los campos.'); return
        }
        setFSaving(true); setFError('')
        try {
            const res = await fetch(`/api/subscriptions/${selSub.id}`, {
                method: 'PUT', headers,
                body: JSON.stringify({ tipoId: fTipoId, montoPagado: fMonto, fecha: fFecha, estatusId: fEstatusId }),
            })
            if (!res.ok) { setFError('Error al actualizar.'); return }
            showNotif('Suscripción actualizada')
            await fetchAll(); closeModal()
        } catch { setFError('Error de conexión.') }
        finally { setFSaving(false) }
    }

    const handleRenovar = async () => {
        if (!selSub || !fTipoId || !fMonto || !fFecha) {
            setFError('Completa todos los campos.'); return
        }
        setFSaving(true); setFError('')
        try {
            const res = await fetch(`/api/subscriptions/${selSub.id}/renovar`, {
                method: 'PUT', headers,
                body: JSON.stringify({ tipoId: fTipoId, montoPagado: fMonto, fecha: fFecha }),
            })
            if (!res.ok) { setFError('Error al renovar.'); return }
            addActivity({ user: 'Tú', action: 'renovaste suscripción de', target: selSub.cliente, iconType: 'dollar', color: '#10b981', bgColor: 'rgba(16,185,129,0.1)' })
            showNotif('Suscripción renovada exitosamente')
            await fetchAll(); closeModal()
        } catch { setFError('Error de conexión.') }
        finally { setFSaving(false) }
    }

    // ── Datos derivados ──────────────────────────────────────
    // Lista filtrada según searchTerm, filterPlan y filterEstatus
    const filtered = subscriptions.filter(s =>
        (filterEstatus ? s.estatus === filterEstatus : true) &&
        (filterPlan    ? s.plan    === filterPlan    : true) &&
        (searchTerm
            ? s.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
              s.plan.toLowerCase().includes(searchTerm.toLowerCase())
            : true)
    )

    const uniquePlanes   = Array.from(new Set(subscriptions.map(s => s.plan)))  // para el <select> de filtro
    const totalActivas   = subscriptions.filter(s => s.estatus === 'Activa').length
    const totalVencidas  = subscriptions.filter(s => s.estatus === 'Vencida').length
    const totalRecaudado = subscriptions.reduce((a, s) => a + Number(s.montoPagado), 0)

    // ── Render ───────────────────────────────────────────────
    return (
        <div className="content-area">

            {/* ── Notificación flotante ── */}
            {notif && (
                <div className={`notification ${notif.type}`}>
                    {notif.type === 'success' ? '✅' : '❌'} {notif.msg}
                </div>
            )}

            {/* ── Tarjetas KPI: Activas, Vencidas, Recaudado, Total ── */}
            <div className="sus-kpi-row">
                {[
                    { icon: <CreditCard size={20}/>, label: 'Activas',          value: totalActivas,         cls: 'sus-kpi-green' },
                    { icon: <CreditCard size={20}/>, label: 'Vencidas',         value: totalVencidas,        cls: 'sus-kpi-red'   },
                    { icon: <CreditCard size={20}/>, label: 'Total Recaudado',  value: fmt(totalRecaudado),  cls: 'sus-kpi-blue'  },
                    { icon: <CreditCard size={20}/>, label: 'Registros',        value: subscriptions.length, cls: 'sus-kpi-purple'},
                ].map(k => (
                    <div key={k.label} className="sus-kpi-card">
                        <div className={`sus-kpi-icon ${k.cls}`}>{k.icon}</div>
                        <div>
                            <p className="sus-kpi-label">{k.label}</p>
                            <p className="sus-kpi-value">{k.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Barra de filtros: búsqueda, plan, estatus, vencimientos, nueva ── */}
            <div className="form-card" style={{ marginBottom: 24, padding: '16px 20px' }}>
                <div className="sus-toolbar">
                    <div className="input-group" style={{ flex: 1, minWidth: 180, marginBottom: 0 }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}/>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Buscar cliente o plan..."
                                style={{ paddingLeft: 32 }}
                            />
                        </div>
                    </div>
                    <div className="input-group" style={{ minWidth: 160, marginBottom: 0 }}>
                        <select className="modal-input" value={filterPlan} onChange={e => setFilterPlan(e.target.value)}>
                            <option value="">Todos los planes</option>
                            {uniquePlanes.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    <div className="input-group" style={{ minWidth: 160, marginBottom: 0 }}>
                        <select className="modal-input" value={filterEstatus} onChange={e => setFilterEstatus(e.target.value)}>
                            <option value="">Todos los estatus</option>
                            {estatusList.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                        </select>
                    </div>
                    <button className="action-btn secondary" onClick={verificarVencimientos} disabled={checkingVenc} title="Marcar como Vencidas las suscripciones expiradas">
                        <RefreshCw size={16} style={{ animation: checkingVenc ? 'spin 1s linear infinite' : 'none' }}/>
                        {checkingVenc ? 'Verificando...' : 'Verificar Vencimientos'}
                    </button>
                    <button className="action-btn primary" onClick={openCreate}>
                        <Plus size={16}/> Nueva Suscripción
                    </button>
                </div>
            </div>

            <div className="table-container">
                {loading ? (
                    <div className="empty-state"><p>Cargando suscripciones...</p></div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <CreditCard size={52} strokeWidth={1}/>
                        <h3>Sin suscripciones</h3>
                        <p>Agrega una nueva con el botón "Nueva Suscripción"</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>ID</th><th>Cliente</th><th>Plan</th><th>Vigencia</th>
                                <th>Fecha</th><th>Monto Pagado</th><th>Estatus</th><th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(s => (
                                <tr key={s.id} className="fade-in">
                                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>#{s.id}</td>
                                    <td style={{ fontWeight: 600 }}>{s.cliente}</td>
                                    <td><span className="badge badge-blue">{s.plan}</span></td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{s.duracionDias}d</td>
                                    <td>{fdate(s.fechaSuscripcion)}</td>
                                    <td style={{ fontWeight: 700 }}>{fmt(s.montoPagado)}</td>
                                    <td><span className={ESTATUS_BADGE[s.estatus] ?? 'badge'}>{s.estatus}</span></td>
                                    <td>
                                        <div className="action-cell">
                                            <button className="icon-btn" title="Ver detalle" onClick={() => openView(s)}>
                                                <Eye size={14}/><span className="btn-label">Ver</span>
                                            </button>
                                            <button className="icon-btn edit" title="Editar" onClick={() => openEdit(s)}>
                                                <Pencil size={14}/><span className="btn-label">Editar</span>
                                            </button>
                                            <button className="icon-btn" title="Correos" onClick={() => openCorreos(s)} style={{ color: 'var(--text-secondary)' }}>
                                                <Mail size={14}/><span className="btn-label">Correos</span>
                                            </button>
                                            <button
                                                className="icon-btn"
                                                title="Renovar"
                                                onClick={() => openRenovar(s)}
                                                disabled={s.estatus === 'Activa'}
                                                style={{ opacity: s.estatus === 'Activa' ? 0.35 : 1 }}
                                            >
                                                <RefreshCw size={14}/><span className="btn-label">Renovar</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {!loading && filtered.length > 0 && (
                    <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        Mostrando {filtered.length} de {subscriptions.length} suscripciones
                    </div>
                )}
            </div>

            {/* ── Modal unificado: view | create | edit | renovar | correos ── */}
            {/* El tipo de modal determina qué formulario se muestra dentro */}
            {modal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: modal === 'correos' ? 560 : 480, width: '92%' }}>
                        <button className="modal-close-btn" onClick={closeModal}><X size={18}/></button>

                        {/* ── Detalle de suscripción (solo lectura) ── */}
                        {modal === 'view' && selSub && (
                            <>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}><Eye size={18}/> Detalle de Suscripción</h3>
                                {[
                                    ['Cliente',        selSub.cliente],
                                    ['Plan',           selSub.plan],
                                    ['Vigencia',       `${selSub.duracionDias} días`],
                                    ['Precio del plan',fmt(selSub.precioPlan)],
                                    ['Fecha',          fdate(selSub.fechaSuscripcion)],
                                    ['Monto pagado',   fmt(selSub.montoPagado)],
                                ].map(([l, v]) => (
                                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                                        <span>{l}:</span><strong style={{ color: 'var(--text-primary)' }}>{v}</strong>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                                    <span>Estatus:</span>
                                    <span className={ESTATUS_BADGE[selSub.estatus] ?? 'badge'}>{selSub.estatus}</span>
                                </div>
                            </>
                        )}

                        {/* ── Formulario: crear nueva suscripción ── */}
                        {modal === 'create' && (
                            <>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}><Plus size={18}/> Nueva Suscripción</h3>
                                {fError && <div className="notification error" style={{ marginBottom: 16 }}>❌ {fError}</div>}
                                <div className="form-group">
                                    <label>Cliente *</label>
                                    <select className="modal-input" value={fClienteId} onChange={e => setFClienteId(Number(e.target.value))}>
                                        <option value="">Selecciona un cliente</option>
                                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Plan *</label>
                                    <select className="modal-input" value={fTipoId} onChange={e => { const id = Number(e.target.value); setFTipoId(id); const t = tipos.find(t => t.id === id); if (t) setFMonto(t.precio) }}>
                                        <option value="">Selecciona un plan</option>
                                        {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre} — {fmt(t.precio)} / {t.duracion_dias} días</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Monto Pagado *</label>
                                    <input type="number" className="modal-input" placeholder="0.00" value={fMonto} onChange={e => setFMonto(Number(e.target.value))}/>
                                </div>
                                <div className="form-group">
                                    <label>Fecha *</label>
                                    <MiniDatePicker value={fFecha} onChange={setFFecha}/>
                                </div>
                                <div className="form-group">
                                    <label>Estatus</label>
                                    <select className="modal-input" value={fEstatusId} onChange={e => setFEstatusId(Number(e.target.value))}>
                                        <option value="">Activa (por defecto)</option>
                                        {estatusList.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                                    </select>
                                </div>
                                <div className="form-actions" style={{ marginTop: 8 }}>
                                    <button className="action-btn secondary" onClick={closeModal}>Cancelar</button>
                                    <button className="action-btn primary" onClick={handleCreate} disabled={fSaving}>{fSaving ? 'Guardando...' : 'Crear Suscripción'}</button>
                                </div>
                            </>
                        )}

                        {/* ── Formulario: editar suscripción existente ── */}
                        {modal === 'edit' && selSub && (
                            <>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><Pencil size={18}/> Editar Suscripción</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 18 }}>Cliente: <strong style={{ color: 'var(--text-secondary)' }}>{selSub.cliente}</strong></p>
                                {fError && <div className="notification error" style={{ marginBottom: 16 }}>❌ {fError}</div>}
                                <div className="form-group">
                                    <label>Plan</label>
                                    <select className="modal-input" value={fTipoId} onChange={e => { const id = Number(e.target.value); setFTipoId(id); const t = tipos.find(t => t.id === id); if (t) setFMonto(t.precio) }}>
                                        {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre} — {fmt(t.precio)}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Monto Pagado</label>
                                    <input type="number" className="modal-input" value={fMonto} onChange={e => setFMonto(Number(e.target.value))}/>
                                </div>
                                <div className="form-group">
                                    <label>Fecha</label>
                                    <MiniDatePicker value={fFecha} onChange={setFFecha}/>
                                </div>
                                <div className="form-group">
                                    <label>Estatus</label>
                                    <select className="modal-input" value={fEstatusId} onChange={e => setFEstatusId(Number(e.target.value))}>
                                        {estatusList.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                                    </select>
                                </div>
                                <div className="form-actions" style={{ marginTop: 8 }}>
                                    <button className="action-btn secondary" onClick={closeModal}>Cancelar</button>
                                    <button className="action-btn primary" onClick={handleEdit} disabled={fSaving}>{fSaving ? 'Guardando...' : 'Guardar Cambios'}</button>
                                </div>
                            </>
                        )}

                        {/* ── Formulario: renovar suscripción (cambia estatus a Activa) ── */}
                        {modal === 'renovar' && selSub && (
                            <>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><RefreshCw size={18}/> Renovar Suscripción</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 20 }}>
                                    Renovando suscripción de <strong style={{ color: 'var(--text-primary)' }}>{selSub.cliente}</strong>.
                                    El estatus cambiará a <strong style={{ color: '#34d399' }}>Activa</strong>.
                                </p>
                                {fError && <div className="notification error" style={{ marginBottom: 16 }}>❌ {fError}</div>}
                                <div className="form-group">
                                    <label>Plan</label>
                                    <select className="modal-input" value={fTipoId} onChange={e => { const id = Number(e.target.value); setFTipoId(id); const t = tipos.find(t => t.id === id); if (t) setFMonto(t.precio) }}>
                                        {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre} — {fmt(t.precio)}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Monto a Cobrar</label>
                                    <input type="number" className="modal-input" value={fMonto} onChange={e => setFMonto(Number(e.target.value))}/>
                                </div>
                                <div className="form-group">
                                    <label>Nueva Fecha de Inicio</label>
                                    <MiniDatePicker value={fFecha} onChange={setFFecha}/>
                                </div>
                                <div className="notification success" style={{ margin: '16px 0' }}>
                                    💰 Total: <strong>{fmt(Number(fMonto) || 0)}</strong>
                                </div>
                                <div className="form-actions">
                                    <button className="action-btn secondary" onClick={closeModal}>Cancelar</button>
                                    <button className="action-btn primary" onClick={handleRenovar} disabled={fSaving}>{fSaving ? 'Renovando...' : 'Confirmar Renovación'}</button>
                                </div>
                            </>
                        )}

                        {/* ── Gestión de correos de contacto de la suscripción ── */}
                        {modal === 'correos' && selSub && (
                            <>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><Mail size={18}/> Correos de Contacto</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', marginBottom: 20 }}>{selSub.cliente} · {selSub.plan}</p>

                                {correosLoading ? (
                                    <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Cargando correos...</p>
                                ) : correos.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', marginBottom: 16 }}>
                                        <Mail size={32} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }}/>
                                        <p style={{ fontSize: '0.85rem' }}>Sin correos registrados</p>
                                    </div>
                                ) : (
                                    <div className="table-container" style={{ marginBottom: 20 }}>
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Correo</th><th>Contacto</th><th>Principal</th><th>Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {correos.map(c => (
                                                    <tr key={c.id}>
                                                        <td><code style={{ fontSize: '0.82rem' }}>{c.correo}</code></td>
                                                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{c.nombre || '—'}</td>
                                                        <td>
                                                            {c.principal
                                                                ? <span className="badge badge-green">Principal</span>
                                                                : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                                                            }
                                                        </td>
                                                        <td>
                                                            <div className="action-cell">
                                                                {!c.principal && (
                                                                    <button className="icon-btn" title="Marcar como principal" onClick={() => handleSetPrincipal(c.id)}>
                                                                        <Star size={13}/><span className="btn-label">Principal</span>
                                                                    </button>
                                                                )}
                                                                <button className="icon-btn delete" title="Eliminar" onClick={() => handleDeleteCorreo(c.id)}>
                                                                    <Trash2 size={13}/><span className="btn-label">Borrar</span>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Agregar correo</p>
                                    {cError && <div className="notification error" style={{ marginBottom: 12 }}>❌ {cError}</div>}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label>Correo *</label>
                                            <input type="email" className="modal-input" placeholder="correo@ejemplo.com" value={cCorreo} onChange={e => setCCorreo(e.target.value)}/>
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label>Nombre del contacto</label>
                                            <input type="text" className="modal-input" placeholder="ej. Administración" value={cNombre} onChange={e => setCNombre(e.target.value)}/>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.87rem', userSelect: 'none' }}>
                                            <input type="checkbox" checked={cPrincipal} onChange={e => setCPrincipal(e.target.checked)} style={{ accentColor: '#3b82f6', width: 15, height: 15 }}/>
                                            Marcar como principal
                                        </label>
                                        <button className="action-btn primary" onClick={handleAddCorreo} disabled={cSaving}>
                                            <Plus size={15}/> {cSaving ? 'Agregando...' : 'Agregar'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .sus-kpi-row {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
                    gap: 14px;
                    margin-bottom: 20px;
                }
                .sus-kpi-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius);
                    padding: 16px 18px;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }
                .sus-kpi-icon {
                    width: 40px; height: 40px;
                    border-radius: var(--radius-sm);
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                }
                .sus-kpi-green  { background: rgba(16,185,129,0.12); color: #34d399; }
                .sus-kpi-red    { background: rgba(239,68,68,0.12);  color: #f87171; }
                .sus-kpi-blue   { background: rgba(59,130,246,0.12); color: #60a5fa; }
                .sus-kpi-purple { background: rgba(139,92,246,0.12); color: #a78bfa; }
                .sus-kpi-label {
                    font-size: 0.73rem;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    margin: 0 0 3px;
                }
                .sus-kpi-value {
                    font-size: 1.2rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin: 0;
                }
                .sus-toolbar {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                    align-items: center;
                }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .badge-purple {
                    background: rgba(139,92,246,0.15);
                    color: #a78bfa;
                    border: 1px solid rgba(139,92,246,0.25);
                }
                `
            }} />
        </div>
    )
}
