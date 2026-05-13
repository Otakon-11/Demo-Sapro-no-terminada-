// ============================================================
// MÓDULO: Reports (Reportes)
// Descripción: Visualización y exportación PDF de los 6 reportes
//   operativos del sistema. Cada pestaña carga sus datos de una
//   ruta API separada y los muestra en una tabla.
// El botón "Exportar PDF" llama a la función correspondiente de
//   reportPdf.ts (jsPDF + jspdf-autotable).
// Rutas API:
//   GET /api/reportes/ingresos-gastos?year=N
//   GET /api/reportes/proyectos-cliente
//   GET /api/reportes/suscripciones-activas
//   GET /api/reportes/rentabilidad-proyectos
//   GET /api/reportes/gastos-concepto
//   GET /api/reportes/clientes-activos
// ============================================================

import { useState, useEffect } from 'react'
import {
  exportIngresosGastos, exportProyectosCliente, exportSuscripciones,
  exportRentabilidad, exportGastosConcepto, exportClientesActivos,
  exportSuscripcionesCliente
} from '../utils/reportPdf'

interface ReportsProps { token: string }

// Clave única para cada pestaña del reporte
type ReportTab = 'ingresos-gastos' | 'proyectos-cliente' | 'suscripciones' | 'rentabilidad' | 'gastos-concepto' | 'clientes-activos' | 'suscripciones-cliente'

// Configuración de pestañas del selector de reportes
const TABS: { id: ReportTab; label: string; icon: string }[] = [
  { id: 'ingresos-gastos',    label: 'Ingresos vs Gastos',      icon: '📊' },
  { id: 'proyectos-cliente',  label: 'Proyectos por Cliente',   icon: '🏢' },
  { id: 'suscripciones',      label: 'Suscripciones Activas',   icon: '🧾' },
  { id: 'rentabilidad',       label: 'Rentabilidad Proyectos',  icon: '💹' },
  { id: 'gastos-concepto',    label: 'Gastos por Concepto',     icon: '🗂️' },
  { id: 'clientes-activos',   label: 'Clientes Activos',        icon: '⭐' },
  { id: 'suscripciones-cliente', label: 'Suscripciones por Cliente', icon: '📋' }  ,
]

// Paleta cíclica de colores para las barras de progreso en el reporte de gastos por concepto
const COLORES = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899','#14b8a6','#84cc16']

// ── Componente principal ─────────────────────────────────────
export default function Reports({ token }: ReportsProps) {
  const [tab, setTab]         = useState<ReportTab>('ingresos-gastos') // pestaña activa
  const [loading, setLoading] = useState(false)
  // Cache de datos por pestaña: { "ingresos-gastos": [...], "suscripciones": [...], ... }
  const [data, setData]       = useState<Record<string, unknown[] | null>>({})
  const [year, setYear]       = useState(new Date().getFullYear()) // filtro de año (aplica solo a ingresos-gastos)

  const headers = { Authorization: `Bearer ${token}` }

  // Formatos de moneda y fecha reutilizados en las tablas
  const fmt     = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  // ── Carga datos de la pestaña activa desde la API ────────
  const loadTab = async (t: ReportTab, y = year) => {
    setLoading(true)
    try {
      // Mapeo de tab → URL del endpoint correspondiente
      const url = t === 'ingresos-gastos'
        ? `/api/reportes/ingresos-gastos?year=${y}`
        : t === 'proyectos-cliente'  ? '/api/reportes/proyectos-cliente'
        : t === 'suscripciones'      ? '/api/reportes/suscripciones-activas'
        : t === 'rentabilidad'       ? '/api/reportes/rentabilidad-proyectos'
        : t === 'gastos-concepto'    ? '/api/reportes/gastos-concepto'
        : t === 'clientes-activos'   ? '/api/reportes/clientes-activos'
        : t === 'suscripciones-cliente' ? '/api/reportes/suscripciones-cliente'
        :                              '/api/reportes/clientes-activos'

      const res = await fetch(url, { headers })
      // Agrega los datos al cache sin borrar las otras pestañas
      if (res.ok) { const json = await res.json(); setData(prev => ({ ...prev, [t]: json })) }
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  // Recarga cuando cambia la pestaña
  useEffect(() => { loadTab(tab) }, [tab])

  // Filas del reporte activo (garantiza siempre un array)
  const rows = (data[tab] || []) as Record<string, unknown>[]

  // ── Exportar PDF según la pestaña activa ────────────────
  // Cada función de reportPdf.ts recibe las filas tipadas del reporte
  const handleExport = () => {
    if (!rows.length) return
    if (tab === 'ingresos-gastos')   exportIngresosGastos(rows as Parameters<typeof exportIngresosGastos>[0], year)
    if (tab === 'proyectos-cliente') exportProyectosCliente(rows as Parameters<typeof exportProyectosCliente>[0])
    if (tab === 'suscripciones')     exportSuscripciones(rows as Parameters<typeof exportSuscripciones>[0])
    if (tab === 'rentabilidad')      exportRentabilidad(rows as Parameters<typeof exportRentabilidad>[0])
    if (tab === 'gastos-concepto')   exportGastosConcepto(rows as Parameters<typeof exportGastosConcepto>[0])
    if (tab === 'clientes-activos')  exportClientesActivos(rows as Parameters<typeof exportClientesActivos>[0])
    if (tab === 'suscripciones-cliente') exportSuscripcionesCliente(rows as Parameters<typeof exportSuscripcionesCliente>[0])
  }

  /* ── helpers ── */
  const diasRestantes = (venc: string) => Math.ceil((new Date(venc).getTime() - Date.now()) / 86400000)

  const ingGasRows = rows as { mes: string; ingresos: number; gastos: number }[]
  const maxIngGas  = Math.max(...ingGasRows.map(r => Math.max(r.ingresos, r.gastos)), 1)

  const gasConceptoRows = rows as { concepto: string; cantidad: number; total: number; porcentaje: string }[]
  const maxGasCon = Math.max(...gasConceptoRows.map(r => r.total), 1)

  return (
    <div className="fade-in">
      {/* Tabs + botón exportar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24, alignItems: 'center' }}>
        {TABS.map(t => (
          <button key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
              background: tab === t.id ? '#3b82f6' : 'var(--bg-card)',
              color: tab === t.id ? '#ffffff' : 'var(--text-primary)',
              cursor: 'pointer', fontWeight: tab === t.id ? 600 : 400,
              display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem',
              transition: 'all 0.15s'
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
        <button
          onClick={handleExport}
          disabled={!rows.length || loading}
          style={{
            marginLeft: 'auto', padding: '8px 18px', borderRadius: 8, border: 'none',
            background: rows.length && !loading ? '#16a34a' : 'var(--bg-card)',
            color: rows.length && !loading ? '#fff' : 'var(--text-muted)',
            cursor: rows.length && !loading ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem',
            fontWeight: 600, transition: 'all 0.15s'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Exportar PDF
        </button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Cargando reporte...</div>}

      {/* ── 1. INGRESOS VS GASTOS ── */}
      {!loading && tab === 'ingresos-gastos' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Año:</label>
            <select value={year} onChange={e => { setYear(Number(e.target.value)); loadTab('ingresos-gastos', Number(e.target.value)) }}
              className="filter-select" style={{ width: 100 }}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 16, marginLeft: 'auto', fontSize: '0.8rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: '#22c55e', display: 'inline-block' }} /> Ingresos</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} /> Gastos</span>
            </div>
          </div>
          {/* Totales */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total Ingresos', val: ingGasRows.reduce((s,r)=>s+r.ingresos,0), color: '#22c55e' },
              { label: 'Total Gastos',   val: ingGasRows.reduce((s,r)=>s+r.gastos,0),   color: '#ef4444' },
              { label: 'Balance',        val: ingGasRows.reduce((s,r)=>s+r.ingresos-r.gastos,0), color: 'var(--accent-primary)' },
            ].map(c => (
              <div key={c.label} className="ing-card" style={{ flex: 1, borderColor: c.color + '44' }}>
                <div className="ing-card-label">{c.label}</div>
                <div className="ing-card-value" style={{ color: c.color }}>{fmt(c.val)}</div>
              </div>
            ))}
          </div>
          {/* Gráfico de barras manual */}
          <div className="table-container" style={{ padding: '24px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 200, borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', padding: '0 8px 0 4px' }}>
              {ingGasRows.map((r, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', justifyContent: 'center' }}>
                    <div title={`Ingresos: ${fmt(r.ingresos)}`} style={{ width: '45%', height: Math.max(2, (r.ingresos / maxIngGas) * 180), background: '#22c55e', borderRadius: '2px 2px 0 0', transition: 'height 0.3s' }} />
                    <div title={`Gastos: ${fmt(r.gastos)}`}   style={{ width: '45%', height: Math.max(2, (r.gastos   / maxIngGas) * 180), background: '#ef4444', borderRadius: '2px 2px 0 0', transition: 'height 0.3s' }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>{r.mes}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Tabla detalle */}
          <div className="table-container" style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Balance</th></tr></thead>
              <tbody>
                {ingGasRows.filter(r => r.ingresos > 0 || r.gastos > 0).map((r, i) => {
                  const bal = r.ingresos - r.gastos
                  return (
                    <tr key={i}>
                      <td>{r.mes} {year}</td>
                      <td style={{ color: '#22c55e', fontWeight: 600 }}>{fmt(r.ingresos)}</td>
                      <td style={{ color: '#ef4444', fontWeight: 600 }}>{fmt(r.gastos)}</td>
                      <td style={{ color: bal >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{fmt(bal)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 2. PROYECTOS POR CLIENTE ── */}
      {!loading && tab === 'proyectos-cliente' && (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Cliente</th><th>Proyectos</th><th>Valor Proyectos</th><th>Ingresos Cobrados</th><th>Por Cobrar</th></tr></thead>
            <tbody>
              {(rows as { id:number; cliente:string; proyectos:number; costoTotal:number; totalIngresos:number }[]).map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.cliente}</td>
                  <td><span className="badge-info" style={{ padding: '2px 10px', borderRadius: 20 }}>{r.proyectos}</span></td>
                  <td>{fmt(r.costoTotal)}</td>
                  <td style={{ color: '#22c55e', fontWeight: 600 }}>{fmt(r.totalIngresos)}</td>
                  <td style={{ color: r.costoTotal - r.totalIngresos > 0 ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>
                    {fmt(Math.max(0, r.costoTotal - r.totalIngresos))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 3. SUSCRIPCIONES ACTIVAS ── */}
      {!loading && tab === 'suscripciones' && (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Cliente</th><th>Plan</th><th>Fecha Inicio</th><th>Vencimiento</th><th>Días Restantes</th><th>Monto</th><th>Estatus</th></tr></thead>
            <tbody>
              {(rows as { id:number; cliente:string; plan:string; fechaInicio:string; fechaVencimiento:string; montoPagado:number; estatus:string }[]).map(r => {
                const dias = diasRestantes(r.fechaVencimiento)
                const alertColor = dias < 0 ? '#ef4444' : dias < 15 ? '#f59e0b' : '#22c55e'
                return (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.cliente}</td>
                    <td>{r.plan}</td>
                    <td className="date-cell">{fmtDate(r.fechaInicio)}</td>
                    <td className="date-cell">{fmtDate(r.fechaVencimiento)}</td>
                    <td><span style={{ color: alertColor, fontWeight: 700 }}>{dias < 0 ? 'Vencida' : `${dias} días`}</span></td>
                    <td style={{ fontWeight: 600 }}>{fmt(r.montoPagado)}</td>
                    <td><span className={r.estatus === 'Activa' ? 'badge-active' : 'badge-error'} style={{ padding: '3px 10px', borderRadius: 20 }}>{r.estatus}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 4. RENTABILIDAD POR PROYECTO ── */}
      {!loading && tab === 'rentabilidad' && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
            {[
              { label: 'Proyectos rentables', val: rows.filter(r => (r as {utilidad:number}).utilidad >= 0).length, color: '#22c55e' },
              { label: 'Proyectos en pérdida', val: rows.filter(r => (r as {utilidad:number}).utilidad < 0).length,  color: '#ef4444' },
              { label: 'Utilidad total', val: fmt((rows as {utilidad:number}[]).reduce((s,r)=>s+r.utilidad,0)), color: 'var(--accent-primary)' },
            ].map(c => (
              <div key={c.label} className="ing-card" style={{ flex: 1, borderColor: (c.color as string) + '44' }}>
                <div className="ing-card-label">{c.label}</div>
                <div className="ing-card-value" style={{ color: c.color, fontSize: typeof c.val === 'string' ? '1.1rem' : '1.8rem' }}>{c.val}</div>
              </div>
            ))}
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Proyecto</th><th>Cliente</th><th>Estatus</th><th>Ingresos</th><th>Gastos</th><th>Utilidad</th></tr></thead>
              <tbody>
                {(rows as {id:number;nombre:string;cliente:string;estatus:string;ingresos:number;gastos:number;utilidad:number}[]).map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.nombre}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{r.cliente || '—'}</td>
                    <td><span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: 20, background: 'var(--bg)', border: '1px solid var(--border)' }}>{r.estatus || '—'}</span></td>
                    <td style={{ color: '#22c55e', fontWeight: 600 }}>{fmt(r.ingresos)}</td>
                    <td style={{ color: '#ef4444', fontWeight: 600 }}>{fmt(r.gastos)}</td>
                    <td style={{ color: r.utilidad >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>{fmt(r.utilidad)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── 5. GASTOS POR CONCEPTO ── */}
      {!loading && tab === 'gastos-concepto' && (
        <>
          <div style={{ marginBottom: 24 }}>
            {gasConceptoRows.map((r, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.875rem' }}>
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORES[i % COLORES.length], display: 'inline-block' }} />
                    {r.concepto}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>{r.porcentaje}% · {r.cantidad} gasto{r.cantidad !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ height: 10, background: 'var(--bg)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${(r.total / maxGasCon) * 100}%`, height: '100%', background: COLORES[i % COLORES.length], borderRadius: 5, transition: 'width 0.4s' }} />
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2, textAlign: 'right' }}>{fmt(r.total)}</div>
              </div>
            ))}
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Concepto</th><th>Cantidad de Gastos</th><th>Total</th><th>% del Total</th></tr></thead>
              <tbody>
                {gasConceptoRows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORES[i % COLORES.length], flexShrink: 0, display: 'inline-block' }} />
                      {r.concepto}
                    </td>
                    <td>{r.cantidad}</td>
                    <td style={{ fontWeight: 700, color: '#ef4444' }}>{fmt(r.total)}</td>
                    <td>{r.porcentaje}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── 6. CLIENTES ACTIVOS ── */}
      {!loading && tab === 'clientes-activos' && (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Cliente</th><th>Tipo</th><th>Proyectos</th><th>Valor Proyectos</th><th>Suscripciones</th><th>Total Suscripciones</th></tr></thead>
            <tbody>
              {(rows as {id:number;cliente:string;tipo:string;proyectos:number;valorProyectos:number;suscripciones:number;totalSuscripciones:number}[]).map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.cliente}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{r.tipo || '—'}</td>
                  <td><span className="badge-info" style={{ padding: '2px 10px', borderRadius: 20 }}>{r.proyectos}</span></td>
                  <td style={{ fontWeight: 600 }}>{fmt(r.valorProyectos)}</td>
                  <td><span className={r.suscripciones > 0 ? 'badge-active' : 'badge-warn'} style={{ padding: '2px 10px', borderRadius: 20 }}>{r.suscripciones}</span></td>
                  <td style={{ fontWeight: 600, color: '#6366f1' }}>{fmt(r.totalSuscripciones)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="empty-state">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M9 17H5a2 2 0 0 0-2 2"/><path d="M9 3H5a2 2 0 0 0-2 2v4"/><rect x="9" y="3" width="13" height="18" rx="2"/></svg>
          <h3>Sin datos para este reporte</h3>
          <p>Registra información en el sistema para verla reflejada aquí</p>
        </div>
      )}

      {/* ── 7. SUSCRIPCIONES POR CLIENTE ── */}
      {!loading && tab === 'suscripciones-cliente' && (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Cliente</th><th>Total Suscripciones</th><th>Total Pagado</th></tr></thead>
            <tbody>
              {(rows as { cliente: string; total_suscripciones: number; total_pagado: number }[]).map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{r.cliente}</td>
                  <td style={{ textAlign: 'center' }}>{r.total_suscripciones}</td>
                  <td style={{ fontWeight: 600, color: '#6366f1' }}>{fmt(r.total_pagado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
