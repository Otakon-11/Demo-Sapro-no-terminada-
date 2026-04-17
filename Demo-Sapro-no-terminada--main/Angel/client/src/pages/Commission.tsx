import { useState, useEffect } from 'react'
import { Eye, Pencil, DollarSign, User, Plus, Search, X, Trash2 } from 'lucide-react'
import { useRecentActivity } from '../context/RecentActivityContext'

interface CommissionEntry {
    id: string
    employee: string
    project: string
    product: string
    amount: number
    commissionRate: number
    status: 'Pagada' | 'Pendiente'
    paymentDate: string | null
}

const initialCommissions: CommissionEntry[] = [
    { id: '1', employee: 'Luis Pérez', project: 'Proyecto Alpha', product: 'Servidor Empresarial', amount: 150000, commissionRate: 8, status: 'Pagada', paymentDate: '2024-04-01' },
    { id: '2', employee: 'Ana Gonzalez', project: 'Venta Cliente X', product: 'Servidor Básico', amount: 80000, commissionRate: 5, status: 'Pagada', paymentDate: '2024-03-25' },
    { id: '3', employee: 'Carlos Méndez', project: 'Proyecto Beta', product: 'Servidor Alta Disp.', amount: 200000, commissionRate: 10, status: 'Pendiente', paymentDate: null },
    { id: '4', employee: 'María López', project: 'Venta Cliente Y', product: 'Servidor Empresarial', amount: 120000, commissionRate: 8, status: 'Pagada', paymentDate: '2024-03-15' },
    { id: '5', employee: 'David Torres', project: 'Proyecto Gamma', product: 'Servidor Básico', amount: 60000, commissionRate: 5, status: 'Pendiente', paymentDate: null },
    { id: '6', employee: 'Sofia Ramírez', project: 'Venta Cliente Z', product: 'Servidor Alta Disp.', amount: 175000, commissionRate: 10, status: 'Pagada', paymentDate: '2024-03-10' },
    { id: '7', employee: 'Sofia Ramírez', project: 'Venta Cliente Z', product: 'Servidor Empresarial', amount: 175000, commissionRate: 10, status: 'Pendiente', paymentDate: null },
]

interface CommissionProps {
    token?: string
}

export default function Commission({ token }: CommissionProps) {
    const [commissions, setCommissions] = useState<CommissionEntry[]>(initialCommissions)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!token) return
        setLoading(true)
        fetch('/api/commissions', { headers: { Authorization: `Bearer ${token}` } })
            .then(res => res.ok ? res.json() : [])
            .then((data: CommissionEntry[]) => {
                if (Array.isArray(data) && data.length > 0) setCommissions(data)
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [token])
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedEmployee, setSelectedEmployee] = useState('')
    const [selectedStatus, setSelectedStatus] = useState('')
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const ITEMS_PER_PAGE = 5

    // Reset page to 1 when filters change
    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, selectedEmployee, selectedStatus])

    // Modal State
    const [activeModal, setActiveModal] = useState<'view' | 'edit' | 'pay' | 'user' | 'create' | null>(null)
    const [selectedCommission, setSelectedCommission] = useState<CommissionEntry | null>(null)

    // Form State for Edit/Create
    const [formData, setFormData] = useState<Partial<CommissionEntry>>({})

    const filteredCommissions = commissions.filter(comm => {
        const matchesEmployee = selectedEmployee ? comm.employee === selectedEmployee : true
        const matchesStatus = selectedStatus ? comm.status === selectedStatus : true
        const matchesSearch = searchTerm ?
            comm.employee.toLowerCase().includes(searchTerm.toLowerCase()) ||
            comm.project.toLowerCase().includes(searchTerm.toLowerCase())
            : true
        return matchesEmployee && matchesStatus && matchesSearch
    })

    const totalPages = Math.max(1, Math.ceil(filteredCommissions.length / ITEMS_PER_PAGE))
    const paginatedCommissions = filteredCommissions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)
    }

    const uniqueEmployees = Array.from(new Set(commissions.map(c => c.employee)))

    // --- Actions ---

    // Inject Activity Context
    const { addActivity } = useRecentActivity()

    const handleOpenModal = (type: 'view' | 'edit' | 'pay' | 'user', commission: CommissionEntry) => {
        setSelectedCommission(commission)
        setFormData({ ...commission }) // specific for edit
        setActiveModal(type)
    }

    const handleOpenCreate = () => {
        setSelectedCommission(null)
        setFormData({
            employee: '',
            project: '',
            product: '',
            amount: 0,
            commissionRate: 5,
            status: 'Pendiente',
            paymentDate: null
        })
        setActiveModal('create')
    }

    const handleCloseModal = () => {
        setActiveModal(null)
        setSelectedCommission(null)
    }

    const handleSaveChanges = async () => {
        if (!selectedCommission) return

        const updatedCommission = { ...selectedCommission, ...formData } as CommissionEntry

        try {
            if (token && !updatedCommission.id.startsWith('mock')) {
                await fetch(`/api/commissions/${updatedCommission.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(updatedCommission)
                })
            }
        } catch (e) {
            console.error('Error updating commission', e)
        }

        const updatedCommissions = commissions.map(c =>
            c.id === selectedCommission.id ? updatedCommission : c
        )
        setCommissions(updatedCommissions)

        handleCloseModal()
    }

    const handleDelete = async () => {
        if (!selectedCommission) return
        
        if (!window.confirm("¿Estás seguro de que deseas eliminar esta comisión?")) return;

        try {
            if (token && !selectedCommission.id.startsWith('mock')) {
                const res = await fetch(`/api/commissions/${selectedCommission.id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Delete failed');
            }
        } catch (e) {
            console.error('Error deleting commission', e);
        }

        setCommissions(commissions.filter(c => c.id !== selectedCommission.id));
        
        addActivity({
            user: 'Tú',
            action: 'eliminaste la comisión de',
            target: `${selectedCommission.employee}`,
            iconType: 'file',
            color: '#ef4444',
            bgColor: 'rgba(239, 68, 68, 0.1)'
        });

        handleCloseModal();
    }

    const handlePayment = async () => {
        if (!selectedCommission) return

        try {
            if (token && !selectedCommission.id.startsWith('mock')) {
                await fetch(`/api/commissions/${selectedCommission.id}/pay`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${token}` }
                })
            }
        } catch (e) {
            console.error('Error paying commission', e)
        }

        const updatedCommissions = commissions.map(c =>
            c.id === selectedCommission.id ? { ...c, status: 'Pagada', paymentDate: new Date().toISOString() } as CommissionEntry : c
        )
        setCommissions(updatedCommissions)

        // Log Activity
        addActivity({
            user: 'Tú', // In a real app, from auth context
            action: 'marcaste como PAGADA la comisión de',
            target: `${selectedCommission.employee} (${selectedCommission.project})`,
            iconType: 'dollar',
            color: '#10b981',
            bgColor: 'rgba(16, 185, 129, 0.1)'
        })

        handleCloseModal()
    }

    const handleCreate = async () => {
        const newCommission: CommissionEntry = {
            id: (Math.max(0, ...commissions.map(c => parseInt(c.id) || 0)) + 1).toString(),
            employee: formData.employee || 'Nuevo Empleado',
            project: formData.project || 'Proyecto Nuevo',
            product: formData.product || 'Producto Genérico',
            amount: Number(formData.amount) || 0,
            commissionRate: Number(formData.commissionRate) || 0,
            status: 'Pendiente',
            paymentDate: null
        }

        try {
            if (token) {
                const res = await fetch('/api/commissions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(newCommission)
                })
                if (res.ok) {
                    const data = await res.json()
                    if (data.id) newCommission.id = data.id
                }
            }
        } catch (e) {
            console.error('Error saving commission', e)
        }

        setCommissions([...commissions, newCommission])

        // Log Activity
        addActivity({
            user: 'Tú',
            action: 'creaste una nueva comisión para',
            target: `${newCommission.employee}`,
            iconType: 'file',
            color: '#3b82f6',
            bgColor: 'rgba(59, 130, 246, 0.1)'
        })

        handleCloseModal()
    }

    // --- Modal Content Renderers ---

    const renderModalContent = () => {
        if (!activeModal) return null

        switch (activeModal) {
            case 'view':
                return selectedCommission && (
                    <div className="modal-content">
                        <h3><Eye size={20} /> Detalles de Comisión</h3>
                        <div className="detail-row">
                            <span>Empleado:</span>
                            <strong>{selectedCommission.employee}</strong>
                        </div>
                        <div className="detail-row">
                            <span>Proyecto:</span>
                            <strong>{selectedCommission.project}</strong>
                        </div>
                        <div className="detail-row">
                            <span>Producto:</span>
                            <strong>{selectedCommission.product}</strong>
                        </div>
                        <div className="detail-row">
                            <span>Monto Venta:</span>
                            <strong>{formatCurrency(selectedCommission.amount)}</strong>
                        </div>
                        <div className="detail-row">
                            <span>Comisión ({selectedCommission.commissionRate}%):</span>
                            <strong className="text-green">{formatCurrency(selectedCommission.amount * (selectedCommission.commissionRate / 100))}</strong>
                        </div>
                        <div className="detail-row">
                            <span>Estado:</span>
                            <span className={`status-badge ${selectedCommission.status === 'Pagada' ? 'status-paid' : 'status-pending'}`}>
                                {selectedCommission.status}
                            </span>
                        </div>
                    </div>
                )

            case 'edit':
                return selectedCommission && (
                    <div className="modal-content">
                        <h3><Pencil size={20} /> Editar Comisión</h3>
                        <div className="form-group">
                            <label>Nombre del Proyecto</label>
                            <input
                                type="text"
                                value={formData.project}
                                onChange={e => setFormData({ ...formData, project: e.target.value })}
                                className="modal-input"
                            />
                        </div>
                        <div className="form-group">
                            <label>Monto Venta ($)</label>
                            <input
                                type="number"
                                value={formData.amount}
                                onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
                                className="modal-input"
                            />
                        </div>
                        <div className="form-group">
                            <label>Porcentaje Comisión (%)</label>
                            <input
                                type="number"
                                value={formData.commissionRate}
                                onChange={e => setFormData({ ...formData, commissionRate: Number(e.target.value) })}
                                className="modal-input"
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="modal-action-btn primary" onClick={handleSaveChanges}>Guardar Cambios</button>
                            <button className="modal-action-btn" style={{ backgroundColor: '#ef4444', color: 'white', flex: 1 }} onClick={handleDelete}>
                                <Trash2 size={16} style={{ verticalAlign: 'text-bottom', marginRight: '6px' }} />
                                Eliminar
                            </button>
                        </div>
                    </div>
                )

            case 'pay':
                return selectedCommission && (
                    <div className="modal-content">
                        <h3><DollarSign size={20} /> Pagar Comisión</h3>
                        <p className="modal-text">
                            ¿Estás seguro de que deseas marcar la comisión de <strong>{selectedCommission.employee}</strong> por
                            el proyecto <strong>{selectedCommission.project}</strong> como PAGADA?
                        </p>
                        <div className="payment-summary">
                            <span>Total a Pagar:</span>
                            <span className="amount">{formatCurrency(selectedCommission.amount * (selectedCommission.commissionRate / 100))}</span>
                        </div>
                        <button className="modal-action-btn success" onClick={handlePayment}>Confirmar Pago</button>
                    </div>
                )

            case 'user':
                return selectedCommission && (
                    <div className="modal-content">
                        <h3><User size={20} /> Detalles del Empleado</h3>
                        <div className="user-profile">
                            <div className="avatar-large">{selectedCommission.employee.charAt(0)}</div>
                            <h4>{selectedCommission.employee}</h4>
                            <p>Ventas Senior</p>
                        </div>
                        <div className="detail-row">
                            <span>Email:</span>
                            <strong>{(selectedCommission.employee.split(' ')[0]).toLowerCase()}@sapro.com</strong>
                        </div>
                        <div className="detail-row">
                            <span>Departamento:</span>
                            <strong>Ventas Corporativas</strong>
                        </div>
                        <div className="detail-row">
                            <span>Fecha Ingreso:</span>
                            <strong>15 Ene 2022</strong>
                        </div>
                    </div>
                )

            case 'create':
                return (
                    <div className="modal-content">
                        <h3><Plus size={20} /> Nueva Comisión</h3>
                        <div className="form-group">
                            <label>Empleado</label>
                            <input
                                type="text"
                                placeholder="Nombre del empleado"
                                value={formData.employee || ''}
                                onChange={e => setFormData({ ...formData, employee: e.target.value })}
                                className="modal-input"
                            />
                        </div>
                        <div className="form-group">
                            <label>Proyecto</label>
                            <input
                                type="text"
                                placeholder="Nombre del proyecto"
                                value={formData.project || ''}
                                onChange={e => setFormData({ ...formData, project: e.target.value })}
                                className="modal-input"
                            />
                        </div>
                        <div className="form-group">
                            <label>Producto</label>
                            <input
                                type="text"
                                placeholder="Producto vendido"
                                value={formData.product || ''}
                                onChange={e => setFormData({ ...formData, product: e.target.value })}
                                className="modal-input"
                            />
                        </div>
                        <div className="form-group">
                            <label>Monto Venta ($)</label>
                            <input
                                type="number"
                                placeholder="0.00"
                                value={formData.amount || ''}
                                onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
                                className="modal-input"
                            />
                        </div>
                        <div className="form-group">
                            <label>Comisión (%)</label>
                            <input
                                type="number"
                                placeholder="5"
                                value={formData.commissionRate || ''}
                                onChange={e => setFormData({ ...formData, commissionRate: Number(e.target.value) })}
                                className="modal-input"
                            />
                        </div>
                        <button className="modal-action-btn success" onClick={handleCreate}>Crear Comisión</button>
                    </div>
                )

            default:
                return null
        }
    }

    return (
        <div className="commission-page fade-in">
            {/* Overlay */}
            {activeModal && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-container" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-btn" onClick={handleCloseModal}>
                            <X size={20} />
                        </button>
                        {renderModalContent()}
                    </div>
                </div>
            )}

            {/* Filters Bar */}
            <div className="filters-card">
                <div className="filter-group">
                    <label>Empleado:</label>
                    <select
                        value={selectedEmployee}
                        onChange={(e) => setSelectedEmployee(e.target.value)}
                        className="filter-select"
                    >
                        <option value="">Todos</option>
                        {uniqueEmployees.map(emp => (
                            <option key={emp} value={emp}>{emp}</option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label>Estado:</label>
                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="filter-select"
                    >
                        <option value="">Todos</option>
                        <option value="Pagada">Pagada</option>
                        <option value="Pendiente">Pendiente</option>
                    </select>
                </div>

                <div className="filter-group search-group">
                    <label>Buscar:</label>
                    <div className="search-input-wrapper">
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                        <button className="search-btn"><Search size={16} /></button>
                    </div>
                </div>

                <button className="new-commission-btn" onClick={handleOpenCreate}>
                    <Plus size={16} />
                    Nueva Comisión
                </button>
            </div>

            {/* Commissions Table */}
            <div className="table-container commission-table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Empleado</th>
                            <th>Proyecto</th>
                            <th>Producto</th>
                            <th>Monto Venta</th>
                            <th>Comisión</th>
                            <th>Estado</th>
                            <th>Fecha de Pago</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedCommissions.map(comm => (
                            <tr key={comm.id} className="fade-in">
                                <td className="font-medium">{comm.employee}</td>
                                <td>{comm.project}</td>
                                <td>{comm.product}</td>
                                <td className="font-bold">{formatCurrency(comm.amount)}</td>
                                <td><span className="badge badge-blue">{comm.commissionRate}%</span></td>
                                <td>
                                    <span className={`status-badge ${comm.status === 'Pagada' ? 'status-paid' : 'status-pending'}`}>
                                        {comm.status}
                                    </span>
                                </td>
                                <td>{comm.paymentDate ? new Date(comm.paymentDate).toLocaleDateString('es-ES') : '--'}</td>
                                <td>
                                    <div className="action-buttons">
                                        <button
                                            className="icon-btn-view"
                                            title="Ver Detalles"
                                            onClick={() => handleOpenModal('view', comm)}
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            className="icon-btn-edit"
                                            title="Editar"
                                            onClick={() => handleOpenModal('edit', comm)}
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            className="icon-btn-pay"
                                            title="Pagar"
                                            disabled={comm.status === 'Pagada'}
                                            onClick={() => handleOpenModal('pay', comm)}
                                        >
                                            <DollarSign size={16} />
                                        </button>
                                        <button
                                            className="icon-btn-user"
                                            title="Ver Empleado"
                                            onClick={() => handleOpenModal('user', comm)}
                                        >
                                            <User size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="table-footer">
                    Mostrando {filteredCommissions.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredCommissions.length)} de {filteredCommissions.length} registros
                    <div className="pagination">
                        <button 
                            disabled={currentPage === 1} 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        >
                            &lt;
                        </button>
                        {[...Array(totalPages)].map((_, i) => (
                            <button 
                                key={i + 1} 
                                className={currentPage === i + 1 ? "active" : ""}
                                onClick={() => setCurrentPage(i + 1)}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button 
                            disabled={currentPage === totalPages} 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        >
                            &gt;
                        </button>
                    </div>
                </div>
            </div>

            {/* Inline Styles for specific elements not in main css yet */}
            <style>{`
                .commission-page {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .filters-card {
                    background: var(--bg-card);
                    padding: 20px;
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                    display: flex;
                    align-items: flex-end;
                    gap: 20px;
                    flex-wrap: wrap;
                }
                .filter-group {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }
                .filter-group label {
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                    font-weight: 500;
                }
                .filter-select, .search-input {
                    padding: 8px 12px;
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    color: var(--text-primary);
                    border-radius: 6px;
                    min-width: 200px;
                }
                .filter-select option {
                    background: var(--bg-card);
                    color: var(--text-primary);
                }
                .filter-select:focus, .search-input:focus {
                    outline: none;
                    border-color: var(--accent-primary);
                }
                .search-input-wrapper {
                    display: flex;
                    gap: 5px;
                }
                .search-btn {
                    padding: 8px 12px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                }
                .new-commission-btn {
                    margin-left: auto;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .new-commission-btn:hover {
                    background: #3b82f6;
                }
                .commission-table-container {
                    background: var(--bg-card);
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                    overflow: hidden;
                    padding: 20px;
                }
                .commission-table-container .data-table th {
                    color: var(--text-muted);
                    border-bottom-color: var(--border-color);
                }
                .commission-table-container .data-table td {
                    color: var(--text-primary);
                    border-bottom-color: var(--border-color);
                }
                .commission-table-container .font-bold { font-weight: 700; color: var(--text-primary); }
                .commission-table-container .font-medium { font-weight: 500; color: var(--text-primary); }
                .status-badge {
                    padding: 4px 10px;
                    border-radius: 4px;
                    font-size: 0.85rem;
                    font-weight: 600;
                }
                .status-paid {
                    background-color: rgba(16, 185, 129, 0.2);
                    color: #34d399;
                    border: 1px solid rgba(16, 185, 129, 0.2);
                }
                .status-pending {
                    background-color: rgba(245, 158, 11, 0.2);
                    color: #fbbf24;
                    border: 1px solid rgba(245, 158, 11, 0.2);
                }
                .action-buttons {
                    display: flex;
                    gap: 8px;
                }
                .icon-btn-view, .icon-btn-edit, .icon-btn-pay, .icon-btn-user {
                    border: 1px solid var(--border-color);
                    background: var(--bg-glass);
                    padding: 6px;
                    border-radius: 4px;
                    cursor: pointer;
                    color: var(--text-secondary);
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .icon-btn-view:hover { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border-color: #3b82f6; }
                .icon-btn-edit:hover { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border-color: #3b82f6; }
                .icon-btn-pay:hover { background: rgba(16, 185, 129, 0.2); color: #34d399; border-color: #10b981; }
                .icon-btn-user:hover { background: rgba(139, 92, 246, 0.2); color: #a78bfa; border-color: #8b5cf6; }
                .icon-btn-pay:disabled { opacity: 0.3; cursor: not-allowed; background: transparent; border-color: var(--border-color); color: var(--text-muted); }
                
                .table-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 20px;
                    color: var(--text-muted);
                    font-size: 0.9rem;
                }
                .pagination {
                    display: flex;
                    gap: 5px;
                }
                .pagination button {
                    padding: 5px 10px;
                    border: 1px solid var(--border-color);
                    background: var(--bg-glass);
                    color: var(--text-secondary);
                    border-radius: 4px;
                    cursor: pointer;
                }
                .pagination button:hover {
                    background: var(--bg-glass-hover);
                    color: var(--text-primary);
                }
                .pagination button.active {
                    background: #3b82f6;
                    color: white;
                    border-color: #3b82f6;
                }
                .pagination button:disabled {
                    opacity: 0.3;
                    cursor: not-allowed;
                }

                /* MODAL STYLES */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    animation: fadeIn 0.2s ease-out;
                }
                .modal-container {
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    width: 100%;
                    max-width: 500px;
                    padding: 24px;
                    position: relative;
                    box-shadow: var(--shadow-lg);
                    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .modal-close-btn {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    background: transparent;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    transition: all 0.2s;
                }
                .modal-close-btn:hover {
                    color: var(--text-primary);
                    background: var(--bg-glass-hover);
                }
                .modal-content h3 {
                    margin-bottom: 20px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: var(--text-primary);
                    font-size: 1.25rem;
                }
                .detail-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 12px 0;
                    border-bottom: 1px solid var(--border-color);
                    color: var(--text-secondary);
                }
                .detail-row:last-child {
                    border-bottom: none;
                }
                .text-green { color: #3b82f6; }
                
                .form-group {
                    margin-bottom: 16px;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 6px;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                }
                .modal-input {
                    width: 100%;
                    padding: 10px 12px;
                    background: var(--bg-glass);
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    color: var(--text-primary);
                    font-size: 0.95rem;
                }
                .modal-input:focus {
                    outline: none;
                    border-color: #3b82f6;
                    background: var(--bg-card);
                }
                .modal-action-btn {
                    width: 100%;
                    padding: 12px;
                    border: none;
                    border-radius: 6px;
                    font-weight: 600;
                    cursor: pointer;
                    margin-top: 10px;
                    transition: transform 0.1s;
                }
                .modal-action-btn:active {
                    transform: scale(0.98);
                }
                .modal-action-btn.primary {
                    background: #3b82f6;
                    color: white;
                }
                .modal-action-btn.success {
                    background: #3b82f6;
                    color: white;
                }
                .modal-text {
                    color: var(--text-secondary);
                    margin-bottom: 20px;
                    line-height: 1.5;
                }
                .payment-summary {
                    background: rgba(16, 185, 129, 0.1);
                    border: 1px solid rgba(16, 185, 129, 0.2);
                    padding: 16px;
                    border-radius: 8px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    color: #34d399;
                    font-weight: 600;
                }
                .user-profile {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid var(--border-color);
                }
                .avatar-large {
                    width: 64px;
                    height: 64px;
                    background: #3b82f6;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: white;
                    margin-bottom: 12px;
                }
            `}</style>
        </div>
    )
}
