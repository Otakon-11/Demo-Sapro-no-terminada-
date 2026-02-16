import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
    LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts'
import {
    LayoutDashboard,
    PieChart as PieIcon,
    TrendingUp,
    Users,
    DollarSign,
    Server,
    Briefcase,
    FileText,
    CheckCircle,
    MessageSquare,
    UserPlus,
    Clock
} from 'lucide-react'

// --- Mock Data ---



// 1. Estado de Proyectos (Donut Chart)
const projectStatusData = [
    { name: 'Por hacer', value: 4, color: '#3B82F6' }, // Blue
    { name: 'En progreso', value: 3, color: '#F59E0B' }, // Yellow/Orange
    { name: 'En revisión', value: 2, color: '#8B5CF6' }, // Purple
    { name: 'Terminados', value: 5, color: '#10B981' }, // Green
]

// 2. Proyectos por Área (Horizontal Bar Chart)
const projectsByAreaData = [
    { name: 'Infraestructura', value: 5 },
    { name: 'Redes', value: 3 },
    { name: 'Ciberseguridad', value: 4 },
    { name: 'Desarrollo', value: 7 },
]

// 3. Comisiones (Donut/Bar Chart - Mixing types as requested, using RadialBar or Pie for simplicity in "Pagadas vs Pendientes")
const commissionsData = [
    { name: 'Pagadas', value: 12500, color: '#10B981' },
    { name: 'Pendientes', value: 4500, color: '#F59E0B' },
    { name: 'En validación', value: 2000, color: '#3B82F6' },
]

// 4. Progreso de Proyectos (Line Chart)
const projectProgressData = [
    { month: 'Ene', iniciados: 2, terminados: 1 },
    { month: 'Feb', iniciados: 3, terminados: 2 },
    { month: 'Mar', iniciados: 4, terminados: 3 },
    { month: 'Abr', iniciados: 2, terminados: 4 },
    { month: 'May', iniciados: 5, terminados: 3 },
    { month: 'Jun', iniciados: 3, terminados: 5 },
]

// 5. Ventas de Servidores (Bar Chart)
const serverSalesData = [
    { month: 'Ene', ventas: 12 },
    { month: 'Feb', ventas: 15 },
    { month: 'Mar', ventas: 10 },
    { month: 'Abr', ventas: 18 },
    { month: 'May', ventas: 22 },
    { month: 'Jun', ventas: 25 },
]

// 6. Rendimiento del Equipo (Radar Chart)
const teamPerformanceData = [
    { subject: 'Tareas Completadas', A: 120, B: 110, fullMark: 150 },
    { subject: 'Tiempo Entrega', A: 98, B: 130, fullMark: 150 },
    { subject: 'Calidad Código', A: 86, B: 130, fullMark: 150 },
    { subject: 'Colaboración', A: 99, B: 100, fullMark: 150 },
    { subject: 'Documentación', A: 85, B: 90, fullMark: 150 },
    { subject: 'Innovación', A: 65, B: 85, fullMark: 150 },
]

import { useRecentActivity } from '../context/RecentActivityContext'

// ... (keep other data constants like projectStatusData, etc.)

import { useState } from 'react'

// ... (keep usage of useRecentActivity)

export default function DashboardOverview() {
    const { activities, getIconComponent } = useRecentActivity()
    const [showAll, setShowAll] = useState(false)

    // Show only first 5 items by default, or all if showAll is true
    const displayedActivities = showAll ? activities : activities.slice(0, 5)

    return (
        <div className="dashboard-overview fade-in" style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>

            {/* Recent Activity Section */}
            <div className="chart-card" style={{ ...cardStyle, gridColumn: '1 / -1', height: 'auto' }}>
                <div style={{ ...headerStyle, justifyContent: 'space-between', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Actividad Reciente</h3>
                        <span style={{ fontSize: '0.9rem', color: '#666', fontWeight: 400 }}>Últimas actualizaciones de tu equipo</span>
                    </div>
                    <button
                        onClick={() => setShowAll(!showAll)}
                        style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.9rem' }}
                    >
                        {showAll ? 'Ver Menos' : 'Ver Todo'}
                    </button>
                </div>

                <div className="activity-list" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {activities.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No hay actividad reciente</div>
                    ) : (
                        displayedActivities.map((item, index) => {
                            const IconComponent = getIconComponent(item.iconType)
                            return (
                                <div key={item.id} style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '16px',
                                    padding: '16px 0',
                                    borderBottom: index !== activities.length - 1 ? '1px solid #222' : 'none'
                                }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '8px',
                                        background: item.bgColor,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: item.color,
                                        flexShrink: 0
                                    }}>
                                        <IconComponent size={20} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <p style={{ color: '#e5e5e5', fontSize: '0.95rem', margin: 0, lineHeight: '1.4' }}>
                                            <span style={{ fontWeight: 600, color: '#fff' }}>{item.user}</span> {item.action} <span style={{ color: '#fff' }}>{item.target}</span>
                                        </p>
                                        <span style={{ color: '#666', fontSize: '0.85rem' }}>{item.time}</span>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* 1. Estado de Proyectos */}
            <div className="chart-card" style={cardStyle}>
                <div style={headerStyle}>
                    <h3><Briefcase size={20} /> Estado de Proyectos</h3>
                </div>
                <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={projectStatusData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                            >
                                {projectStatusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff' }} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 2. Proyectos por Área */}
            <div className="chart-card" style={cardStyle}>
                <div style={headerStyle}>
                    <h3><LayoutDashboard size={20} /> Carga por Área</h3>
                </div>
                <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={projectsByAreaData}
                            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#333" />
                            <XAxis type="number" stroke="#888" />
                            <YAxis dataKey="name" type="category" width={100} stroke="#888" />
                            <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                            <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} name="Proyectos" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 3. Comisiones */}
            <div className="chart-card" style={cardStyle}>
                <div style={headerStyle}>
                    <h3><DollarSign size={20} /> Comisiones</h3>
                </div>
                <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={commissionsData}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} ${(percent ? percent * 100 : 0).toFixed(0)}%`}
                                dataKey="value"
                                stroke="none"
                            >
                                {commissionsData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: number | undefined) => [`$${(value || 0).toLocaleString()}`, 'Monto']}
                                contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 4. Progreso de Proyectos */}
            <div className="chart-card" style={cardStyle}>
                <div style={headerStyle}>
                    <h3><TrendingUp size={20} /> Productividad</h3>
                </div>
                <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={projectProgressData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="month" stroke="#888" />
                            <YAxis stroke="#888" />
                            <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff' }} />
                            <Legend />
                            <Line type="monotone" dataKey="iniciados" stroke="#3B82F6" strokeWidth={2} name="Iniciados" dot={{ r: 4, strokeWidth: 0, fill: '#3B82F6' }} />
                            <Line type="monotone" dataKey="terminados" stroke="#10B981" strokeWidth={2} name="Terminados" dot={{ r: 4, strokeWidth: 0, fill: '#10B981' }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 5. Ventas de Servidores */}
            <div className="chart-card" style={cardStyle}>
                <div style={headerStyle}>
                    <h3><Server size={20} /> Ventas Servidores</h3>
                </div>
                <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={serverSalesData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                            <XAxis dataKey="month" stroke="#888" />
                            <YAxis stroke="#888" />
                            <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                            <Bar dataKey="ventas" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Unidades" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 6. Rendimiento del Equipo */}
            <div className="chart-card" style={cardStyle}>
                <div style={headerStyle}>
                    <h3><Users size={20} /> Rendimiento de Equipo</h3>
                </div>
                <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={teamPerformanceData}>
                            <PolarGrid stroke="#444" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#aaa', fontSize: 12 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 150]} tick={{ fill: '#888' }} axisLine={false} />
                            <Radar name="Equipo Dev" dataKey="A" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.5} />
                            <Radar name="Equipo Design" dataKey="B" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.5} />
                            <Legend />
                            <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', color: '#fff' }} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    )
}

const cardStyle: React.CSSProperties = {
    backgroundColor: '#0d0d0d', // var(--bg-card)
    borderRadius: '12px',
    border: '1px solid #222', // var(--border-color)
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
}

const headerStyle: React.CSSProperties = {
    marginBottom: '15px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#ffffff', // var(--text-primary)
    fontWeight: 600
}
