import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { FileText, CheckCircle, MessageSquare, UserPlus, Clock, DollarSign, AlertCircle, LucideIcon } from 'lucide-react'

// Define the shape of an activity item
export type ActivityIconType = 'file' | 'check' | 'message' | 'user' | 'clock' | 'dollar' | 'alert'

export interface ActivityItem {
    id: number
    user: string
    action: string
    target: string
    time: string // For simplicity in this demo, we'll store the pre-formatted string or ISO string
    timestamp: number // For sorting
    iconType: ActivityIconType
    color: string
    bgColor: string
}

// Icon mapping
export const iconMap: Record<string, LucideIcon> = {
    file: FileText,
    check: CheckCircle,
    message: MessageSquare,
    user: UserPlus,
    clock: Clock,
    dollar: DollarSign,
    alert: AlertCircle
}

export interface RecentActivityContextType {
    activities: ActivityItem[]
    addActivity: (activity: Omit<ActivityItem, 'id' | 'timestamp' | 'time'>) => void
    getIconComponent: (type: string) => LucideIcon
}

const RecentActivityContext = createContext<RecentActivityContextType | undefined>(undefined)

const initialActivities: ActivityItem[] = [
    {
        id: 1,
        user: 'Sarah Chen',
        action: 'subió nuevos archivos de diseño para',
        target: 'Dashboard v2',
        time: 'hace 2 minutos',
        timestamp: Date.now() - 120000,
        iconType: 'file',
        color: '#3b82f6',
        bgColor: 'rgba(59, 130, 246, 0.1)'
    },
    {
        id: 2,
        user: 'Michael Torres',
        action: 'completó la tarea',
        target: '"Integración API"',
        time: 'hace 15 minutos',
        timestamp: Date.now() - 900000,
        iconType: 'check',
        color: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.1)'
    },
    {
        id: 3,
        user: 'Emma Wilson',
        action: 'comentó en tu',
        target: 'propuesta de proyecto',
        time: 'hace 1 hora',
        timestamp: Date.now() - 3600000,
        iconType: 'message',
        color: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.1)'
    }
]

export const RecentActivityProvider = ({ children }: { children: ReactNode }) => {
    const [activities, setActivities] = useState<ActivityItem[]>(initialActivities)

    // Load from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem('sapro_recent_activities')
        if (stored) {
            try {
                const parsed = JSON.parse(stored)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setActivities(parsed)
                }
            } catch (e) {
                console.error("Failed to parse stored activities", e)
            }
        }
    }, [])

    // Update localStorage when activities change
    useEffect(() => {
        if (activities.length > 0) {
            localStorage.setItem('sapro_recent_activities', JSON.stringify(activities))
        }
    }, [activities])

    const calculateTimeAgo = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000)

        let interval = seconds / 31536000
        if (interval > 1) return "hace " + Math.floor(interval) + " años"
        interval = seconds / 2592000
        if (interval > 1) return "hace " + Math.floor(interval) + " meses"
        interval = seconds / 86400
        if (interval > 1) return "hace " + Math.floor(interval) + " días"
        interval = seconds / 3600
        if (interval > 1) return "hace " + Math.floor(interval) + " horas"
        interval = seconds / 60
        if (interval > 1) return "hace " + Math.floor(interval) + " minutos"

        return "Justo ahora"
    }

    const addActivity = (newActivity: Omit<ActivityItem, 'id' | 'timestamp' | 'time'>) => {
        const activity: ActivityItem = {
            ...newActivity,
            id: Date.now(),
            timestamp: Date.now(),
            time: 'Justo ahora'
        }

        setActivities(prev => {
            const updated = [activity, ...prev].slice(0, 20)
            return updated
        })
    }

    // Periodically update "time ago" strings
    useEffect(() => {
        const interval = setInterval(() => {
            setActivities(prev => prev.map(a => ({
                ...a,
                time: calculateTimeAgo(a.timestamp)
            })))
        }, 60000) // Update every minute

        return () => clearInterval(interval)
    }, [])

    const getIconComponent = (type: string) => {
        return iconMap[type] || Clock
    }

    return (
        <RecentActivityContext.Provider value={{ activities, addActivity, getIconComponent }}>
            {children}
        </RecentActivityContext.Provider>
    )
}

export const useRecentActivity = () => {
    const context = useContext(RecentActivityContext)
    if (context === undefined) {
        throw new Error('useRecentActivity must be used within a RecentActivityProvider')
    }
    return context
}
