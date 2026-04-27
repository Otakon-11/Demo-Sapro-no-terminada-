// ============================================================
// UTILIDAD: Exportación de Reportes a PDF
// Genera reportes en formato PDF usando jsPDF + autoTable.
// Cada función recibe los datos del reporte correspondiente
// y produce y descarga un archivo .pdf automáticamente.
// ============================================================

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Constantes de marca y colores ─────────────────────────
const BRAND   = 'CITS'                                          // Nombre de la empresa en el header
const SYSTEM  = 'SAPRO – Sistema de Administración de Proyectos' // Nombre del sistema
const PRIMARY = [79, 70, 229]  as [number, number, number]      // Azul/violeta corporativo #4f46e5
const GREEN   = [34, 197, 94]  as [number, number, number]      // Verde para ingresos/positivos
const RED     = [239, 68, 68]  as [number, number, number]      // Rojo para gastos/negativos
const GRAY    = [107, 114, 128] as [number, number, number]     // Gris para textos secundarios

// ── Helpers de formato ────────────────────────────────────
// Formatea un número como moneda MXN
const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

// Formatea una fecha ISO a "dd mmm aaaa" en español
const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// ── addHeader: encabezado común para todos los reportes ──
// Dibuja la banda superior morada con nombre de empresa,
// nombre del sistema, fecha de generación y título del reporte.
function addHeader(doc: jsPDF, title: string) {
  const W = doc.internal.pageSize.getWidth()

  // Banda superior (28 mm de alto) en color primario
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, W, 28, 'F')

  // Nombre de la empresa (grande, blanco, negrita)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(BRAND, 14, 12)

  // Nombre del sistema (pequeño, bajo el logo)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(SYSTEM, 14, 20)

  // Fecha y hora de generación (alineada a la derecha)
  const fecha = new Date().toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
  doc.text(`Generado: ${fecha}`, W - 14, 20, { align: 'right' })

  // Título del reporte específico (debajo de la banda)
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, 42)

  // Línea divisora azul bajo el título
  doc.setDrawColor(...PRIMARY)
  doc.setLineWidth(0.5)
  doc.line(14, 46, W - 14, 46)
}

// ── addFooter: pie de página en todas las hojas ───────────
// Itera sobre todas las páginas y agrega nombre del sistema
// a la izquierda y "Página X de Y" a la derecha.
function addFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages()
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text(`${BRAND} · ${SYSTEM}`, 14, H - 8)
    doc.text(`Página ${i} de ${pages}`, W - 14, H - 8, { align: 'right' })
  }
}

// ============================================================
// REPORTE 1: Ingresos vs Gastos por mes
// Formato: Carta vertical (portrait)
// Incluye: 3 tarjetas de resumen + tabla mensual
// ============================================================
export function exportIngresosGastos(
  rows: { mes: string; ingresos: number; gastos: number }[],
  year: number
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  addHeader(doc, `Reporte: Ingresos vs Gastos — ${year}`)

  // Calcular totales y balance del año
  const totalIng = rows.reduce((s, r) => s + r.ingresos, 0)
  const totalGas = rows.reduce((s, r) => s + r.gastos, 0)
  const balance  = totalIng - totalGas

  // Dibujar 3 tarjetas de resumen (Ingresos / Gastos / Balance)
  const cardY = 52
  const cardW = 56
  const cards = [
    { label: 'Total Ingresos', value: fmt(totalIng), color: GREEN },
    { label: 'Total Gastos',   value: fmt(totalGas), color: RED   },
    { label: 'Balance Neto',   value: fmt(balance),  color: balance >= 0 ? GREEN : RED },
  ]
  cards.forEach((c, i) => {
    const x = 14 + i * (cardW + 5)
    doc.setFillColor(245, 247, 250)
    doc.roundedRect(x, cardY, cardW, 20, 3, 3, 'F')
    doc.setFontSize(7); doc.setTextColor(...GRAY); doc.setFont('helvetica', 'normal')
    doc.text(c.label, x + 4, cardY + 7)
    doc.setFontSize(11); doc.setTextColor(...c.color); doc.setFont('helvetica', 'bold')
    doc.text(c.value, x + 4, cardY + 16)
  })

  // Tabla: solo muestra meses con datos (filtra meses en cero)
  autoTable(doc, {
    startY: cardY + 28,
    head: [['Mes', 'Ingresos', 'Gastos', 'Balance']],
    body: rows
      .filter(r => r.ingresos > 0 || r.gastos > 0)
      .map(r => {
        const bal = r.ingresos - r.gastos
        return [`${r.mes} ${year}`, fmt(r.ingresos), fmt(r.gastos), fmt(bal)]
      }),
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'right', textColor: GREEN }, // Ingresos en verde
      2: { halign: 'right', textColor: RED   }, // Gastos en rojo
      3: { halign: 'right' },
    },
    alternateRowStyles: { fillColor: [248, 249, 252] }, // Filas alternas con fondo claro
    styles: { fontSize: 9, cellPadding: 4 },
  })

  addFooter(doc)
  doc.save(`ingresos-gastos-${year}.pdf`)
}

// ============================================================
// REPORTE 2: Proyectos por Cliente
// Formato: Carta horizontal (landscape)
// Muestra cuánto vale cada cliente en proyectos e ingresos
// ============================================================
export function exportProyectosCliente(
  rows: { cliente: string; proyectos: number; costoTotal: number; totalIngresos: number }[]
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  addHeader(doc, 'Reporte: Proyectos por Cliente')

  autoTable(doc, {
    startY: 52,
    head: [['Cliente', 'Proyectos', 'Valor Total', 'Ingresos Cobrados', 'Por Cobrar']],
    body: rows.map(r => [
      r.cliente,
      r.proyectos,
      fmt(r.costoTotal),
      fmt(r.totalIngresos),
      fmt(Math.max(0, r.costoTotal - r.totalIngresos)), // Saldo pendiente por cobrar
    ]),
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right', textColor: GREEN },
      4: { halign: 'right', textColor: [245, 158, 11] as [number,number,number] }, // Pendiente en naranja
    },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    styles: { fontSize: 9, cellPadding: 4 },
  })

  addFooter(doc)
  doc.save('proyectos-por-cliente.pdf')
}

// ============================================================
// REPORTE 3: Suscripciones Activas
// Formato: Carta horizontal (landscape)
// Incluye días restantes calculados desde la fecha actual
// ============================================================
export function exportSuscripciones(
  rows: { cliente: string; plan: string; fechaInicio: string; fechaVencimiento: string; montoPagado: number; estatus: string }[]
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  addHeader(doc, 'Reporte: Suscripciones Activas')

  // Calcula días restantes desde hoy hasta la fecha de vencimiento
  const diasRestantes = (venc: string) =>
    Math.ceil((new Date(venc).getTime() - Date.now()) / 86400000)

  autoTable(doc, {
    startY: 52,
    head: [['Cliente', 'Plan', 'Fecha Inicio', 'Vencimiento', 'Días Rest.', 'Monto', 'Estatus']],
    body: rows.map(r => {
      const dias = diasRestantes(r.fechaVencimiento)
      return [
        r.cliente, r.plan,
        fmtDate(r.fechaInicio),
        fmtDate(r.fechaVencimiento),
        dias < 0 ? 'Vencida' : `${dias} días`, // Muestra "Vencida" si ya pasó
        fmt(r.montoPagado),
        r.estatus,
      ]
    }),
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      4: { halign: 'center' },
      5: { halign: 'right' },
      6: { halign: 'center' },
    },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    styles: { fontSize: 9, cellPadding: 4 },
  })

  addFooter(doc)
  doc.save('suscripciones-activas.pdf')
}

// ============================================================
// REPORTE 4: Rentabilidad por Proyecto
// Formato: Carta horizontal (landscape)
// Incluye tarjetas resumen + la utilidad coloreada por valor
// ============================================================
export function exportRentabilidad(
  rows: { nombre: string; cliente: string; estatus: string; ingresos: number; gastos: number; utilidad: number }[]
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  addHeader(doc, 'Reporte: Rentabilidad por Proyecto')

  const totalUtil = rows.reduce((s, r) => s + r.utilidad, 0)

  // Tarjetas de resumen: rentables / en pérdida / utilidad total
  const cardY = 52
  const cardW = 80
  const cards = [
    { label: 'Proyectos rentables', value: String(rows.filter(r => r.utilidad >= 0).length), color: GREEN },
    { label: 'En pérdida',          value: String(rows.filter(r => r.utilidad < 0).length),  color: RED   },
    { label: 'Utilidad total',       value: fmt(totalUtil), color: totalUtil >= 0 ? GREEN : RED },
  ]
  cards.forEach((c, i) => {
    const x = 14 + i * (cardW + 5)
    doc.setFillColor(245, 247, 250)
    doc.roundedRect(x, cardY, cardW, 20, 3, 3, 'F')
    doc.setFontSize(7); doc.setTextColor(...GRAY); doc.setFont('helvetica', 'normal')
    doc.text(c.label, x + 4, cardY + 7)
    doc.setFontSize(11); doc.setTextColor(...c.color); doc.setFont('helvetica', 'bold')
    doc.text(c.value, x + 4, cardY + 16)
  })

  autoTable(doc, {
    startY: cardY + 28,
    head: [['Proyecto', 'Cliente', 'Estatus', 'Ingresos', 'Gastos', 'Utilidad']],
    body: rows.map(r => [
      r.nombre, r.cliente || '—', r.estatus || '—',
      fmt(r.ingresos), fmt(r.gastos), fmt(r.utilidad),
    ]),
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      3: { halign: 'right', textColor: GREEN },
      4: { halign: 'right', textColor: RED   },
      5: { halign: 'right' },
    },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    styles: { fontSize: 9, cellPadding: 4 },
    // Colorea la columna de Utilidad: verde si positiva, rojo si negativa
    didParseCell(data) {
      if (data.column.index === 5 && data.section === 'body') {
        const val = rows[data.row.index]?.utilidad ?? 0
        data.cell.styles.textColor = val >= 0 ? GREEN : RED
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  addFooter(doc)
  doc.save('rentabilidad-proyectos.pdf')
}

// ============================================================
// REPORTE 5: Gastos por Concepto
// Formato: Carta vertical (portrait)
// Muestra el total gastado agrupado por tipo de concepto
// ============================================================
export function exportGastosConcepto(
  rows: { concepto: string; cantidad: number; total: number; porcentaje: string }[]
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  addHeader(doc, 'Reporte: Gastos por Concepto')

  const grandTotal = rows.reduce((s, r) => s + r.total, 0)

  // Texto del gran total antes de la tabla
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.setFont('helvetica', 'normal')
  doc.text(`Total de gastos registrados: ${fmt(grandTotal)}`, 14, 52)

  autoTable(doc, {
    startY: 58,
    head: [['Concepto', 'Cantidad de Gastos', 'Total', '% del Total']],
    body: rows.map(r => [r.concepto, r.cantidad, fmt(r.total), `${r.porcentaje}%`]),
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'right', textColor: RED }, // Total en rojo (son egresos)
      3: { halign: 'center' },
    },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    styles: { fontSize: 9, cellPadding: 4 },
  })

  addFooter(doc)
  doc.save('gastos-por-concepto.pdf')
}

// ============================================================
// REPORTE 6: Clientes Activos
// Formato: Carta horizontal (landscape)
// Muestra la actividad de cada cliente: proyectos y suscripciones
// ============================================================
export function exportClientesActivos(
  rows: { cliente: string; tipo: string; proyectos: number; valorProyectos: number; suscripciones: number; totalSuscripciones: number }[]
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  addHeader(doc, 'Reporte: Clientes Activos')

  autoTable(doc, {
    startY: 52,
    head: [['Cliente', 'Tipo', 'Proyectos', 'Valor Proyectos', 'Suscripciones', 'Total Suscripciones']],
    body: rows.map(r => [
      r.cliente, r.tipo || '—',
      r.proyectos, fmt(r.valorProyectos),
      r.suscripciones, fmt(r.totalSuscripciones),
    ]),
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      1: { halign: 'left' },
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'center' },
      5: { halign: 'right', textColor: PRIMARY }, // En color primario para destacar
    },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    styles: { fontSize: 9, cellPadding: 4 },
  })

  addFooter(doc)
  doc.save('clientes-activos.pdf')
}

// ============================================================
// REPORTE 7: Suscripciones por Cliente
// Formato: Carta vertical (portrait)
// Muestra el detalle de suscripciones para cada cliente
// ============================================================
export function exportSuscripcionesCliente(
  rows: { cliente: string; total_suscripciones: number; total_pagado: number }[]
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  addHeader(doc, 'Reporte: Suscripciones por Cliente')

  autoTable(doc, {
    startY: 52,
    head: [['Cliente', 'Total Suscripciones', 'Total Pagado']],
    body: rows.map(r => [
      r.cliente,
      r.total_suscripciones,
      fmt(r.total_pagado)
    ]),
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'right', textColor: PRIMARY }, // En color primario para destacar
    },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    styles: { fontSize: 9, cellPadding: 4 },
  })

  addFooter(doc)
  doc.save('suscripciones-por-cliente.pdf')
}

