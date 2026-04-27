import { useState, useEffect } from 'react'
import Login from './pages/Login.tsx'
import Dashboard from './pages/Dashboard.tsx'

import { RecentActivityProvider } from './context/RecentActivityContext'

function App() {
    const [token, setToken] = useState<string | null>(null)
    const [user, setUser] = useState<string>('')

    useEffect(() => {
        const savedToken = sessionStorage.getItem('sapro_token')
        const savedUser = sessionStorage.getItem('sapro_user')
        if (savedToken) {
            fetch('/api/verify-token', { headers: { 'Authorization': `Bearer ${savedToken}` } })
                .then(res => {
                    if (res.ok) {
                        setToken(savedToken)
                        setUser(savedUser || 'Admin')
                    } else {
                        sessionStorage.removeItem('sapro_token')
                        sessionStorage.removeItem('sapro_user')
                    }
                })
                .catch(() => {
                    // Si el backend no responde, también limpiamos para forzar login
                    sessionStorage.removeItem('sapro_token')
                    sessionStorage.removeItem('sapro_user')
                })
        }
    }, [])

    const handleLogin = (newToken: string, userName: string) => {
        setToken(newToken)
        setUser(userName)
        sessionStorage.setItem('sapro_token', newToken)
        sessionStorage.setItem('sapro_user', userName)
    }

    const handleLogout = () => {
        if (token) {
            fetch('/api/logout', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            })
        }
        setToken(null)
        setUser('')
        sessionStorage.removeItem('sapro_token')
        sessionStorage.removeItem('sapro_user')
    }

    if (!token) {
        return <Login onLogin={handleLogin} />
    }

    return (
        <RecentActivityProvider>
            <Dashboard token={token} user={user} onLogout={handleLogout} />
        </RecentActivityProvider>
    )
}

export default App
