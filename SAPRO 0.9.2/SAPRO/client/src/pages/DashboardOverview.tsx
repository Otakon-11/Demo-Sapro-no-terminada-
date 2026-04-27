// ============================================================
// MÓDULO: DashboardOverview
// Descripción: Vista de inicio del sistema — muestra KPIs
//   financieros en tiempo real y múltiples gráficas con datos
//   de ingresos, gastos, proyectos y suscripciones.
// Ruta API: GET /api/dashboard/stats  → objeto con kpis + arrays
// Librería de gráficas: Recharts (BarChart, PieChart, LineChart)
// Iconos: lucide-react
//
// Estructura de la página:
//   1. Tarjetas KPI (6 cards: ingresos, gastos, balance, subs, proyectos, clientes)
//   2. Fila 1: BarChart "Ingresos vs Gastos mensual" + PieChart "Estado Proyectos"
//   3. Fila 2: BarChart horizontal "Gastos por Concepto" + PieChart "Suscripciones por Estatus"
//   4. Fila 3: LineChart "Productividad Mensual" + BarChart "Clientes por Tipo"
//   5. Feed "Actividad Reciente" (desde RecentActivityContext)
// ============================================================

import { useState, useEffect } from 'react'
import React from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, TrendingDown, CreditCard, Users, Briefcase,
  DollarSign, Activity, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { useRecentActivity } from '../context/RecentActivityContext'

// ─── Constantes ────────────────────────────────────────────────────────────────

// Paleta cíclica de colores para gráficas genéricas (Pie, Bar)
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6']

// Color específico por nombre de estatus de suscripción
const STATUS_COLORS: Record<string, string> = {
  Activa:       '#10b981',
  Vencida:      '#ef4444',
  Cancelada:    '#6b7280',
  'En revisión':'#f59e0b',
  Suspendida:   '#8b5cf6',
}

// Color específico por nombre de estatus de proyecto
const PROJECT_COLORS: Record<string, string> = {
  Terminado:     '#10b981',
  'En progreso': '#6366f1',
  'Por hacer':   '#f59e0b',
  Planeación:    '#3b82f6',
  Cancelado:     '#ef4444',
}

// Formatea número como MXN sin decimales (ej. $12,500)
const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)

// Estilos reutilizables del Tooltip de Recharts (adaptado al tema oscuro/claro)
const TIP = {
  contentStyle: {
    backgroundColor: 'var(--bg-card)',
    borderColor: 'var(--border-color)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    fontSize: '0.82rem',
  },
  cursor: { fill: 'rgba(99,102,241,0.06)' }, // fondo del highlight al hacer hover
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

// KPIs principales calculados en el backend (/api/dashboard/stats)
interface Kpis {
  ingresosMesActual: number    // sum ingresos del mes en curso
  gastosMesActual: number      // sum gastos del mes en curso
  ingresosAno: number          // sum ingresos del año en curso
  gastosAno: number            // sum gastos del año en curso
  suscripcionesActivas: number // count Ess_ID_Estatus_Suscripcion = 1
  clientesActivos: number      // count Cli_Estatus = true
  proyectosActivos: number     // count proyectos que NO están terminados/cancelados
}

// Forma completa del objeto que retorna /api/dashboard/stats
interface Stats {
  kpis: Kpis
  ingresosGastosMes:   { month: string; ingresos: number; gastos: number }[]  // por mes (ej. "Ene".."Dic")
  projectStatus:       { name: string; value: number }[]   // conteo por estatus
  suscripcionesEstatus:{ name: string; value: number }[]   // conteo por estatus de suscripción
  gastosConcepto:      { name: string; value: number }[]   // sum gastos por concepto
  clientesByType:      { name: string; value: number }[]   // conteo por tipo de cliente
  projectProgress:     { month: string; iniciados: number; terminados: number }[] // productividad mensual
}

interface DashboardOverviewProps { token?: string }

// ─── Subcomponente: ChartCard ──────────────────────────────────────────────────
// Envuelve cada gráfica en una tarjeta con título, subtítulo e ícono consistentes.

function ChartCard({ title, subtitle, icon, children }: {
  title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-color)',
      borderRadius: 14, padding: '18px 20px', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: subtitle ? 4 : 14 }}>
        <span style={{ color: 'var(--accent-primary)', display: 'flex' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{title}</span>
      </div>
      {subtitle && <p style={{ margin: '0 0 12px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>{subtitle}</p>}
      {children}
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function DashboardOverview({ token }: DashboardOverviewProps) {
  // activities: array de eventos recientes (creados por otros módulos al llamar addActivity)
  const { activities, getIconComponent } = useRecentActivity()
  const [showAll, setShowAll]   = useState(false)      // toggle "Ver todo" / "Ver menos"
  const [loading, setLoading]   = useState(true)
  const [stats,   setStats]     = useState<Stats | null>(null)

  // Carga las estadísticas del dashboard al montar o cuando cambia el token
  useEffect(() => {
    if (!token) return
    fetch('/api/dashboard/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStats(d) })
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
      Cargando datos del dashboard...
    </div>
  )

  if (!stats) return (
    <div style={{ padding: 40, color: 'var(--text-muted)' }}>No se pudieron cargar los datos.</div>
  )

  const { kpis } = stats
  // Balance calculado en frontend (ingresos - gastos)
  const balanceMes = kpis.ingresosMesActual - kpis.gastosMesActual
  const balanceAno = kpis.ingresosAno - kpis.gastosAno

  // Definición declarativa de las 6 tarjetas KPI (label, valor, color, ícono)
  const KPI_CARDS = [
    {
      label: 'Ingresos del Mes',
      value: fmt(kpis.ingresosMesActual),
      sub: `Acum. año: ${fmt(kpis.ingresosAno)}`,
      color: '#10b981', bg: 'rgba(16,185,129,0.12)',
      Icon: TrendingUp,
    },
    {
      label: 'Gastos del Mes',
      value: fmt(kpis.gastosMesActual),
      sub: `Acum. año: ${fmt(kpis.gastosAno)}`,
      color: '#ef4444', bg: 'rgba(239,68,68,0.12)',
      Icon: TrendingDown,
    },
    {
      label: 'Balance del Mes',
      value: fmt(balanceMes),
      sub: `Balance año: ${fmt(balanceAno)}`,
      color: balanceMes >= 0 ? '#10b981' : '#ef4444',
      bg: balanceMes >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
      Icon: balanceMes >= 0 ? ArrowUpRight : ArrowDownRight,
    },
    {
      label: 'Suscripciones Activas',
      value: kpis.suscripcionesActivas,
      sub: 'planes vigentes',
      color: '#6366f1', bg: 'rgba(99,102,241,0.12)',
      Icon: CreditCard,
    },
    {
      label: 'Proyectos en Curso',
      value: kpis.proyectosActivos,
      sub: 'proyectos activos',
      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',
      Icon: Briefcase,
    },
    {
      label: 'Clientes Activos',
      value: kpis.clientesActivos,
      sub: 'registrados en sistema',
      color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',
      Icon: Users,
    },
  ]

  // Muestra solo 5 actividades recientes, o todas si showAll=true
  const displayedActivities = showAll ? activities : activities.slice(0, 5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {KPI_CARDS.map(k => (
          <div key={k.label} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 14, padding: '16px 18px',
            display: 'flex', alignItems: 'flex-start', gap: 14,
          }}>
            <div style={{
              width: 46, height: 46, borderRadius: 11, background: k.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: k.color, flexShrink: 0,
            }}>
              <k.Icon size={21} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: '0 0 3px', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                {k.label}
              </p>
              <p style={{ margin: '0 0 3px', fontSize: '1.3rem', fontWeight: 800, color: k.color, lineHeight: 1.1 }}>
                {k.value}
              </p>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {k.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Row 1: Ingresos vs Gastos + Estado Proyectos ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
        <ChartCard
          title="Ingresos vs Gastos"
          subtitle={`Comparativa mensual ${new Date().getFullYear()}`}
          icon={<Activity size={17}/>}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.ingresosGastosMes} barGap={4} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...TIP}
                formatter={(v: number | undefined, n: string | undefined) => [fmt(v ?? 0), n === 'ingresos' ? 'Ingresos' : 'Gastos']} />
              <Legend formatter={(v: string) => v === 'ingresos' ? 'Ingresos' : 'Gastos'} />
              <Bar dataKey="ingresos" fill="#10b981" radius={[4, 4, 0, 0]} name="ingresos" />
              <Bar dataKey="gastos"   fill="#ef4444" radius={[4, 4, 0, 0]} name="gastos" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Estado de Proyectos" icon={<Briefcase size={17}/>}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={stats.projectStatus} cx="50%" cy="44%"
                innerRadius={60} outerRadius={88} paddingAngle={3}
                dataKey="value" stroke="none">
                {stats.projectStatus.map((e, i) => (
                  <Cell key={i} fill={PROJECT_COLORS[e.name] || COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TIP.contentStyle} />
              <Legend iconType="circle" iconSize={9} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Row 2: Gastos por Concepto + Suscripciones por Estatus ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ChartCard title="Gastos por Concepto" subtitle="top categorías del año" icon={<DollarSign size={17}/>}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart layout="vertical" data={stats.gastosConcepto}
              margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
              <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis dataKey="name" type="category" width={120} stroke="var(--text-muted)" fontSize={11}
                tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TIP.contentStyle} cursor={TIP.cursor}
                formatter={(v: number | undefined) => [fmt(v ?? 0), 'Total']} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Total">
                {stats.gastosConcepto.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Suscripciones por Estatus" icon={<CreditCard size={17}/>}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={stats.suscripcionesEstatus} cx="50%" cy="44%"
                innerRadius={56} outerRadius={82} paddingAngle={3}
                dataKey="value" stroke="none">
                {stats.suscripcionesEstatus.map((e, i) => (
                  <Cell key={i} fill={STATUS_COLORS[e.name] || COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TIP.contentStyle} />
              <Legend iconType="circle" iconSize={9} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Row 3: Productividad + Clientes por Tipo ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ChartCard title="Productividad Mensual"
          subtitle="proyectos iniciados vs terminados"
          icon={<TrendingUp size={17}/>}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.projectProgress} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TIP.contentStyle} />
              <Legend />
              <Line type="monotone" dataKey="iniciados" stroke="#6366f1" strokeWidth={2.5}
                name="Iniciados" dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="terminados" stroke="#10b981" strokeWidth={2.5}
                name="Terminados" dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Clientes por Tipo" icon={<Users size={17}/>}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.clientesByType} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TIP.contentStyle} cursor={TIP.cursor} />
              <Bar dataKey="value" name="Clientes" radius={[4, 4, 0, 0]}>
                {stats.clientesByType.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Recent Activity ── */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-color)',
        borderRadius: 14, padding: '18px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: '0 0 3px', fontSize: '0.92rem', fontWeight: 700 }}>Actividad Reciente</h3>
            <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>Últimas acciones registradas en el sistema</p>
          </div>
          <button onClick={() => setShowAll(s => !s)} style={{
            background: 'none', border: 'none', color: 'var(--accent-primary)',
            cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
          }}>
            {showAll ? 'Ver menos' : 'Ver todo'}
          </button>
        </div>

        {activities.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0', margin: 0 }}>
            Sin actividad reciente
          </p>
        ) : displayedActivities.map((item, idx) => {
          const Icon = getIconComponent(item.iconType)
          return (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 0',
              borderBottom: idx < displayedActivities.length - 1
                ? '1px solid var(--border-color)' : 'none',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: item.bgColor, color: item.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon size={17} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontSize: '0.87rem', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{item.user}</strong>{' '}
                  {item.action}{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{item.target}</strong>
                </p>
                <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>{item.time}</p>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
