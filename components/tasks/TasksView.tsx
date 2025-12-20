"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Trash2, Calendar, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format, isPast, isToday } from "date-fns"

// Ensure interface matches Schema
interface Task {
    id: string
    title: string
    status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED'
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    deadline: Date | null
    isCompleted: boolean // Deprecated in UI but present in data
    assignedTo: {
        id: string
        name: string | null
        email: string | null
    }
}

interface User {
    id: string
    name: string | null
    email: string | null
}

interface TasksViewProps {
    initialTasks: any[] // Using any here to bypass strict typing issues with Prisma JSON dates before they are parsed
    users: User[]
    isAdmin: boolean
}

export function TasksView({ initialTasks, users, isAdmin }: TasksViewProps) {
    const router = useRouter()
    const [filterUserId, setFilterUserId] = useState<string>("all")
    const [loadingId, setLoadingId] = useState<string | null>(null)

    // Filter tasks
    const filteredTasks = initialTasks.filter(task => {
        if (filterUserId === "all") return true
        return task.assignedTo.id === filterUserId
    })

    const handleStatusChange = async (id: string, newStatus: string) => {
        setLoadingId(id)
        await fetch("/api/tasks", {
            method: "PATCH",
            body: JSON.stringify({ id, status: newStatus }),
        })
        router.refresh()
        setLoadingId(null)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return
        await fetch(`/api/tasks?id=${id}`, { method: "DELETE" })
        router.refresh()
    }

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'URGENT': return 'bg-red-600 hover:bg-red-600'
            case 'HIGH': return 'bg-orange-500 hover:bg-orange-500'
            case 'MEDIUM': return 'bg-blue-500 hover:bg-blue-500'
            case 'LOW': return 'bg-slate-500 hover:bg-slate-500'
            default: return 'bg-slate-500'
        }
    }

    const getStatusVariant = (s: string) => {
        switch (s) {
            case 'DONE': return 'outline' // or success color
            case 'IN_PROGRESS': return 'default'
            case 'BLOCKED': return 'destructive'
            default: return 'secondary'
        }
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle>All Tasks ({filteredTasks.length})</CardTitle>
                {isAdmin && users.length > 0 && (
                    <div className="w-[200px]">
                        <Select value={filterUserId} onValueChange={setFilterUserId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by user" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Users</SelectItem>
                                {users.map(user => (
                                    <SelectItem key={user.id} value={user.id}>
                                        {user.name || user.email}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {filteredTasks.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No tasks found.</p>
                    ) : (
                        filteredTasks.map((task) => (
                            <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 last:border-0 last:pb-0 gap-4">
                                <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2">
                                        <Badge className={`text-[10px] h-5 ${getPriorityColor(task.priority)}`}>
                                            {task.priority}
                                        </Badge>
                                        <span className={`text-sm font-medium ${task.status === 'DONE' ? 'line-through text-muted-foreground' : ''}`}>
                                            {task.title}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        {isAdmin && (
                                            <span>
                                                Assigned to: <strong>{task.assignedTo.name || task.assignedTo.email}</strong>
                                            </span>
                                        )}
                                        {task.deadline && (
                                            <span className={`flex items-center gap-1 ${isPast(new Date(task.deadline)) && !isToday(new Date(task.deadline)) && task.status !== 'DONE' ? 'text-red-500 font-bold' : ''}`}>
                                                <Calendar className="h-3 w-3" />
                                                {format(new Date(task.deadline), 'dd/MM/yyyy')}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Select
                                        value={task.status}
                                        onValueChange={(val) => handleStatusChange(task.id, val)}
                                        disabled={loadingId === task.id}
                                    >
                                        <SelectTrigger className="w-[130px] h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="TODO">To Do</SelectItem>
                                            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                            <SelectItem value="BLOCKED">Blocked</SelectItem>
                                            <SelectItem value="DONE">Done</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {isAdmin && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(task.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
