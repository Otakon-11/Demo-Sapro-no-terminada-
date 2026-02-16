import { useState } from 'react'

interface LoginProps {
    onLogin: (token: string, user: string) => void
}

export default function Login({ onLogin }: LoginProps) {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        // Verificación local (sin necesidad de servidor)
        setTimeout(() => {
            if (username === 'Otakon' && password === '123456789') {
                onLogin('local-token-' + Date.now(), 'Otakon')
            } else {
                setError('Contraseña incorrecta')
            }
            setLoading(false)
        }, 500)
    }

    return (
        <div className="login-page">
            <div className="login-left">
                <div className="branding-minimal">
                    <div className="branding-shape"></div>
                    <h2>SAPRO</h2>
                    <p>Powered by CITIS</p>
                </div>
            </div>

            <div className="login-right">
                <div className="login-card">
                    <div className="login-header">
                        <h1>Login</h1>
                        <p>Accede con tus credenciales</p>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        <div className="input-group">
                            <label htmlFor="username">Usuario</label>
                            <div className="input-wrapper">
                                <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                                <input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Usuario"
                                    autoComplete="username"
                                    required
                                />
                            </div>
                        </div>

                        <div className="input-group">
                            <label htmlFor="password">Contraseña</label>
                            <div className="input-wrapper">
                                <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Contraseña"
                                    autoComplete="current-password"
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="login-error">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="15" y1="9" x2="9" y2="15" />
                                    <line x1="9" y1="9" x2="15" y2="15" />
                                </svg>
                                {error}
                            </div>
                        )}

                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading ? (
                                <span className="spinner"></span>
                            ) : (
                                'Entrar'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
