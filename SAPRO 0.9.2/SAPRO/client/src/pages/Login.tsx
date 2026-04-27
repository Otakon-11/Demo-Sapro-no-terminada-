import { useState } from 'react'

interface LoginProps {
    onLogin: (token: string, user: string) => void
}

export default function Login({ onLogin }: LoginProps) {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPass, setShowPass] = useState(false)
    const [error,    setError]    = useState('')
    const [loading,  setLoading]  = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const res  = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            })
            const data = await res.json().catch(() => ({}))
            if (res.ok && data.success && data.token && data.user) {
                onLogin(data.token, data.user)
                return
            }
            setError(data.error || 'Credenciales incorrectas')
        } catch {
            setError('No se pudo conectar al servidor. ¿Está en marcha?')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={s.page}>

            {/* ── Panel izquierdo ─────────────────────────────────────── */}
            <div style={s.left}>
                {/* Grid decorativo */}
                <div style={s.grid} aria-hidden="true">
                    {Array.from({ length: 80 }).map((_, i) => (
                        <div key={i} style={s.gridCell} />
                    ))}
                </div>

                {/* Contenido branding */}
                <div style={s.brand}>
                    {/* Logo geométrico */}
                    <div style={s.logoWrap}>
                        <div style={s.logoOuter}>
                            <div style={s.logoInner}>
                                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                                    <rect x="4"  y="4"  width="10" height="10" fill="white" opacity="0.9"/>
                                    <rect x="18" y="4"  width="10" height="10" fill="white" opacity="0.5"/>
                                    <rect x="4"  y="18" width="10" height="10" fill="white" opacity="0.5"/>
                                    <rect x="18" y="18" width="10" height="10" fill="#3b82f6"/>
                                </svg>
                            </div>
                        </div>
                    </div>

                    <h1 style={s.brandTitle}>SAPRO</h1>
                    <p style={s.brandSub}>Sistema de Administración de Proyectos</p>

                    {/* Divisor */}
                    <div style={s.divider} />

                    {/* Badges de características */}
                    <div style={s.features}>
                        {[
                            { icon: '🔐', text: 'Acceso seguro' },
                            { icon: '📊', text: 'Gestión en tiempo real' },
                            { icon: '⚡', text: 'Alto rendimiento' },
                        ].map(f => (
                            <div key={f.text} style={s.featureItem}>
                                <span style={s.featureIcon}>{f.icon}</span>
                                <span style={s.featureText}>{f.text}</span>
                            </div>
                        ))}
                    </div>

                    <p style={s.powered}>Powered by <strong style={{ color: '#3b82f6' }}>CITS</strong></p>
                </div>
            </div>

            {/* ── Panel derecho ───────────────────────────────────────── */}
            <div style={s.right}>
                <div style={s.card}>

                    {/* Header */}
                    <div style={s.cardHeader}>
                        <div style={s.cardLogo}>
                            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                                <rect x="4"  y="4"  width="10" height="10" fill="white" opacity="0.9"/>
                                <rect x="18" y="4"  width="10" height="10" fill="white" opacity="0.5"/>
                                <rect x="4"  y="18" width="10" height="10" fill="white" opacity="0.5"/>
                                <rect x="18" y="18" width="10" height="10" fill="#3b82f6"/>
                            </svg>
                        </div>
                        <h2 style={s.cardTitle}>Bienvenido</h2>
                        <p style={s.cardSub}>Ingresa tus credenciales para continuar</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} style={s.form}>

                        {/* Usuario */}
                        <div style={s.fieldWrap}>
                            <label style={s.label}>Correo / Usuario</label>
                            <div style={s.inputBox}>
                                <svg style={s.fieldIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                    <circle cx="12" cy="7" r="4"/>
                                </svg>
                                <input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder="usuario@cits.com.mx"
                                    autoComplete="username"
                                    required
                                    style={s.input}
                                    onFocus={e => {
                                        e.currentTarget.parentElement!.style.borderColor = '#3b82f6'
                                        e.currentTarget.parentElement!.style.boxShadow   = '0 0 0 3px rgba(59,130,246,0.15)'
                                    }}
                                    onBlur={e => {
                                        e.currentTarget.parentElement!.style.borderColor = 'rgba(255,255,255,0.08)'
                                        e.currentTarget.parentElement!.style.boxShadow   = 'none'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Contraseña */}
                        <div style={s.fieldWrap}>
                            <label style={s.label}>Contraseña</label>
                            <div style={s.inputBox}>
                                <svg style={s.fieldIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                                <input
                                    id="password"
                                    type={showPass ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••••"
                                    autoComplete="current-password"
                                    required
                                    style={{ ...s.input, paddingRight: 44 }}
                                    onFocus={e => {
                                        e.currentTarget.parentElement!.style.borderColor = '#3b82f6'
                                        e.currentTarget.parentElement!.style.boxShadow   = '0 0 0 3px rgba(59,130,246,0.15)'
                                    }}
                                    onBlur={e => {
                                        e.currentTarget.parentElement!.style.borderColor = 'rgba(255,255,255,0.08)'
                                        e.currentTarget.parentElement!.style.boxShadow   = 'none'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(v => !v)}
                                    style={s.eyeBtn}
                                    tabIndex={-1}
                                >
                                    {showPass ? (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                            <line x1="1" y1="1" x2="23" y2="23"/>
                                        </svg>
                                    ) : (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={s.errorBox}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="15" y1="9" x2="9" y2="15"/>
                                    <line x1="9" y1="9" x2="15" y2="15"/>
                                </svg>
                                {error}
                            </div>
                        )}

                        {/* Botón */}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                ...s.submitBtn,
                                opacity: loading ? 0.75 : 1,
                                cursor:  loading ? 'not-allowed' : 'pointer',
                            }}
                            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'none' }}
                        >
                            {loading ? (
                                <span style={s.spinner} />
                            ) : (
                                <>
                                    Iniciar Sesión
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="5" y1="12" x2="19" y2="12"/>
                                        <polyline points="12 5 19 12 12 19"/>
                                    </svg>
                                </>
                            )}
                        </button>

                    </form>

                    {/* Footer */}
                    <p style={s.footer}>
                        © {new Date().getFullYear()} CITS · Todos los derechos reservados
                    </p>
                </div>
            </div>

            {/* Keyframes */}
            <style>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes shake {
                    0%,100% { transform: translateX(0); }
                    20%,60% { transform: translateX(-5px); }
                    40%,80% { transform: translateX(5px); }
                }
            `}</style>
        </div>
    )
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
    page: {
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        background: '#000',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },

    /* ── Izquierdo ── */
    left: {
        flex: 1.1,
        background: '#050505',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
    },
    grid: {
        position: 'absolute',
        inset: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(10, 1fr)',
        gridTemplateRows: 'repeat(8, 1fr)',
        opacity: 0.07,
        pointerEvents: 'none',
    },
    gridCell: {
        border: '0.5px solid rgba(255,255,255,0.4)',
    },
    brand: {
        position: 'relative',
        zIndex: 1,
        textAlign: 'center',
        padding: '0 40px',
        animation: 'fadeUp 0.9s cubic-bezier(0.16,1,0.3,1) both',
    },
    logoWrap: {
        display: 'flex',
        justifyContent: 'center',
        marginBottom: 28,
    },
    logoOuter: {
        width: 80,
        height: 80,
        borderRadius: 20,
        background: 'rgba(59,130,246,0.12)',
        border: '1px solid rgba(59,130,246,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoInner: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandTitle: {
        fontSize: '3rem',
        fontWeight: 800,
        letterSpacing: '0.12em',
        color: '#fff',
        margin: '0 0 8px',
        textTransform: 'uppercase' as const,
    },
    brandSub: {
        fontSize: '0.78rem',
        color: 'rgba(255,255,255,0.35)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase' as const,
        margin: 0,
    },
    divider: {
        width: 40,
        height: 2,
        background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)',
        margin: '28px auto',
        borderRadius: 2,
    },
    features: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 12,
        marginBottom: 32,
    },
    featureItem: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 8,
    },
    featureIcon: {
        fontSize: '1rem',
    },
    featureText: {
        fontSize: '0.83rem',
        color: 'rgba(255,255,255,0.5)',
    },
    powered: {
        fontSize: '0.75rem',
        color: 'rgba(255,255,255,0.2)',
        letterSpacing: '0.06em',
    },

    /* ── Derecho ── */
    right: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        background: '#000',
    },
    card: {
        width: '100%',
        maxWidth: 380,
        animation: 'fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s both',
    },
    cardHeader: {
        textAlign: 'center' as const,
        marginBottom: 36,
    },
    cardLogo: {
        width: 44,
        height: 44,
        borderRadius: 12,
        background: 'rgba(59,130,246,0.15)',
        border: '1px solid rgba(59,130,246,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 16px',
    },
    cardTitle: {
        fontSize: '1.6rem',
        fontWeight: 700,
        color: '#fff',
        margin: '0 0 6px',
        letterSpacing: '-0.02em',
    },
    cardSub: {
        fontSize: '0.85rem',
        color: 'rgba(255,255,255,0.35)',
        margin: 0,
    },

    /* ── Form ── */
    form: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 18,
    },
    fieldWrap: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 7,
    },
    label: {
        fontSize: '0.82rem',
        fontWeight: 500,
        color: 'rgba(255,255,255,0.55)',
        letterSpacing: '0.02em',
    },
    inputBox: {
        position: 'relative' as const,
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        transition: 'border-color 0.2s, box-shadow 0.2s',
    },
    fieldIcon: {
        position: 'absolute' as const,
        left: 14,
        color: 'rgba(255,255,255,0.25)',
        pointerEvents: 'none' as const,
        flexShrink: 0,
    },
    input: {
        width: '100%',
        padding: '13px 14px 13px 42px',
        background: 'transparent',
        border: 'none',
        outline: 'none',
        color: '#fff',
        fontSize: '0.93rem',
        fontFamily: 'inherit',
    },
    eyeBtn: {
        position: 'absolute' as const,
        right: 12,
        background: 'transparent',
        border: 'none',
        color: 'rgba(255,255,255,0.3)',
        cursor: 'pointer',
        padding: 4,
        display: 'flex',
        alignItems: 'center',
    },
    errorBox: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '11px 14px',
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: 8,
        color: '#fca5a5',
        fontSize: '0.83rem',
        animation: 'shake 0.4s cubic-bezier(0.36,0.07,0.19,0.97)',
    },
    submitBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '14px',
        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        color: '#fff',
        border: 'none',
        borderRadius: 10,
        fontSize: '0.95rem',
        fontWeight: 600,
        fontFamily: 'inherit',
        letterSpacing: '0.01em',
        boxShadow: '0 4px 20px rgba(59,130,246,0.35)',
        transition: 'transform 0.15s, box-shadow 0.15s',
        marginTop: 4,
    },
    spinner: {
        display: 'inline-block',
        width: 20,
        height: 20,
        border: '2.5px solid rgba(255,255,255,0.25)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'spin 0.65s linear infinite',
    },
    footer: {
        textAlign: 'center' as const,
        marginTop: 28,
        fontSize: '0.73rem',
        color: 'rgba(255,255,255,0.15)',
    },
}
