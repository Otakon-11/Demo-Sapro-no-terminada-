import { useState } from 'react'

interface Member {
    initials: string
    color: 'blue' | 'green' | 'purple' | 'orange' | 'red'
}

interface Task {
    id: string
    title: string
    description: string
    tag: string
    tagColor: 'blue' | 'green' | 'orange' | 'purple' | 'red'
    members: Member[]
    progress?: number
}

interface Column {
    id: string
    title: string
    tasks: Task[]
}

const initialColumns: Column[] = [
    {
        id: 'todo',
        title: 'Por hacer',
        tasks: [
            {
                id: 't1',
                title: 'Design System Updates',
                description: 'Update color palette and typography scale for v2.0',
                tag: 'Design',
                tagColor: 'blue',
                members: [{ initials: 'SC', color: 'blue' }]
            },
            {
                id: 't2',
                title: 'User Research Report',
                description: 'Compile findings from Q4 user interviews',
                tag: 'Research',
                tagColor: 'orange',
                members: [{ initials: 'EW', color: 'green' }]
            },
            {
                id: 't3',
                title: 'Mobile App Wireframes',
                description: 'Create low-fidelity wireframes for iOS app',
                tag: 'Design',
                tagColor: 'blue',
                members: [{ initials: 'SC', color: 'blue' }, { initials: 'JL', color: 'purple' }]
            },
            {
                id: 't4',
                title: 'API Documentation',
                description: 'Write comprehensive docs for REST endpoints',
                tag: 'Dev',
                tagColor: 'green',
                members: [{ initials: 'MT', color: 'orange' }]
            }
        ]
    },
    {
        id: 'in-progress',
        title: 'En progreso',
        tasks: [
            {
                id: 't5',
                title: 'Dashboard Redesign',
                description: 'Implement new analytics dashboard with charts',
                tag: 'Dev',
                tagColor: 'green',
                members: [{ initials: 'SC', color: 'blue' }, { initials: 'MT', color: 'orange' }],
                progress: 65
            },
            {
                id: 't6',
                title: 'Payment Integration',
                description: 'Integrate Stripe for subscription billing',
                tag: 'Dev',
                tagColor: 'green',
                members: [{ initials: 'MT', color: 'orange' }],
                progress: 40
            },
            {
                id: 't7',
                title: 'Email Templates',
                description: 'Design responsive email templates for campaigns',
                tag: 'Design',
                tagColor: 'blue',
                members: [{ initials: 'EW', color: 'green' }],
                progress: 80
            }
        ]
    },
    {
        id: 'review',
        title: 'En revision',
        tasks: [
            {
                id: 't8',
                title: 'Authentication Flow',
                description: 'OAuth2 implementation with social login options',
                tag: 'Dev',
                tagColor: 'green',
                members: [{ initials: 'JL', color: 'purple' }]
            },
            {
                id: 't9',
                title: 'Landing Page Copy',
                description: 'Review and finalize marketing copy for launch',
                tag: 'Marketing',
                tagColor: 'orange',
                members: [{ initials: 'EW', color: 'green' }, { initials: 'SC', color: 'blue' }]
            }
        ]
    },
    {
        id: 'done',
        title: 'Hecho',
        tasks: [
            {
                id: 't10',
                title: 'Brand Guidelines',
                description: 'Complete brand identity documentation',
                tag: 'Design',
                tagColor: 'blue',
                members: [{ initials: 'SC', color: 'blue' }]
            },
            {
                id: 't11',
                title: 'Database Migration',
                description: 'Migrate legacy data to new schema',
                tag: 'Dev',
                tagColor: 'green',
                members: [{ initials: 'MT', color: 'orange' }]
            },
            {
                id: 't12',
                title: 'User Onboarding Flow',
                description: 'New user welcome sequence and tooltips',
                tag: 'Design',
                tagColor: 'blue',
                members: [{ initials: 'EW', color: 'green' }, { initials: 'JL', color: 'purple' }]
            },
            {
                id: 't13',
                title: 'Performance Audit',
                description: 'Lighthouse audit and optimization',
                tag: 'Dev',
                tagColor: 'green',
                members: [{ initials: 'MT', color: 'orange' }]
            },
            {
                id: 't14',
                title: 'Security Review',
                description: 'Third-party security assessment completed',
                tag: 'Security',
                tagColor: 'red',
                members: [{ initials: 'JL', color: 'purple' }]
            }
        ]
    }
]

export default function Projects() {
    const [columns] = useState<Column[]>(initialColumns)

    return (
        <div className="kanban-board fade-in">
            {columns.map(column => (
                <div key={column.id} className="kanban-column">
                    <div className="kanban-header">
                        <span className="kanban-title">{column.title}</span>
                        <span className="kanban-count">{column.tasks.length}</span>
                    </div>
                    <div className="kanban-cards">
                        {column.tasks.map(task => (
                            <div key={task.id} className="kanban-card">
                                <div className="kanban-card-title">{task.title}</div>
                                <div className="kanban-card-desc">{task.description}</div>

                                {task.progress !== undefined && (
                                    <div className="progress-bar" style={{ marginBottom: '12px' }}>
                                        <div
                                            className="progress-fill"
                                            style={{ width: `${task.progress}%` }}
                                        />
                                    </div>
                                )}

                                <div className="kanban-card-footer">
                                    <span className={`badge badge-${task.tagColor}`}>{task.tag}</span>
                                    <div className="avatar-group">
                                        {task.members.map((member, idx) => (
                                            <div key={idx} className={`avatar ${member.color}`}>
                                                {member.initials}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
