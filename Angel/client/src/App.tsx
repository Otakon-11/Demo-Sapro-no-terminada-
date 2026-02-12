import { useState, useEffect } from 'react'
import Login from './pages/Login.tsx'
import Dashboard from './pages/Dashboard.tsx'

function App() {
    const [token, setToken] = useState<string | null>(null)
    const [user, setUser] = useState<string>('')

    useEffect(() => {
        const savedToken = localStorage.getItem('sapro_token')
        const savedUser = localStorage.getItem('sapro_user')
        if (savedToken) {
            setToken(savedToken)
            setUser(savedUser || 'Admin')
        }
    }, [])

    const handleLogin = (newToken: string, userName: string) => {
        setToken(newToken)
        setUser(userName)
        localStorage.setItem('sapro_token', newToken)
        localStorage.setItem('sapro_user', userName)
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
        localStorage.removeItem('sapro_token')
        localStorage.removeItem('sapro_user')
    }

    if (!token) {
        return <Login onLogin={handleLogin} />
    }

    return <Dashboard token={token} user={user} onLogout={handleLogout} />
}

export default App
