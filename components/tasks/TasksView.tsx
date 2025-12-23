"use client"


import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Trash2, Calendar } from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { format, isPast, isToday } from "date-fns"

// Ensure interface matches Schema


interface User {
    id: string
    name: string | null
    email: string | null
}

interface TasksViewProps {
    initialTasks: Array<{
        id: string;
        title: string;
        status: string;
        priority: string;
        deadline: Date | string | null;
        assignees: Array<{ id: string; name: string | null }>;
    }>
    users: User[]
    isAdmin: boolean
}

export function TasksView({ initialTasks, users, isAdmin }: TasksViewProps) {
    const router = useRouter()
    const [tasks, setTasks] = useState(initialTasks)
    const [filterUserId, setFilterUserId] = useState<string>("all")
    const [loadingId, setLoadingId] = useState<string | null>(null)

    // Sync local state when server data changes (e.g., after task creation)
    useEffect(() => {
        setTasks(initialTasks)
    }, [initialTasks])

    // Filter tasks
    const filteredTasks = tasks.filter(task => {
        if (filterUserId === "all") return true
        if (task.assignees && task.assignees.length > 0) {
            return task.assignees.some((a) => a.id === filterUserId)
        }
        return false
    })

    const handleStatusChange = async (id: string, newStatus: string) => {
        // Optimistic update
        const previousTasks = tasks
        setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t))

        try {
            await fetch("/api/tasks", {
                method: "PATCH",
                body: JSON.stringify({ id, status: newStatus }),
            })
            router.refresh()
        } catch (error) {
            // Revert on error
            setTasks(previousTasks)
            console.error("Failed to update task:", error)
        }
    }

    const handleCheckboxChange = async (id: string, currentStatus: string, checked: boolean) => {
        // Optimistic update
        const newStatus = checked ? 'DONE' : (currentStatus === 'DONE' ? 'TODO' : currentStatus)
        const previousTasks = tasks
        setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t))

        try {
            await fetch("/api/tasks", {
                method: "PATCH",
                body: JSON.stringify({ id, status: newStatus }),
            })
            router.refresh()
        } catch (error) {
            // Revert on error
            setTasks(previousTasks)
            console.error("Failed to update task:", error)
        }
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
                                <div className="flex items-start gap-3 flex-1">
                                    <Checkbox
                                        checked={task.status === 'DONE'}
                                        onCheckedChange={(checked) => handleCheckboxChange(task.id, task.status, checked as boolean)}
                                        disabled={loadingId === task.id}
                                        className="mt-1"
                                    />
                                    <div className="space-y-1 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-medium ${task.status === 'DONE' ? 'line-through text-muted-foreground' : ''}`}>
                                                {task.title}
                                            </span>
                                            {task.assignees && task.assignees.length > 0 && (
                                                <span className="text-xs text-muted-foreground ml-2">
                                                    ({task.assignees.map(a => a.name).join(', ')})
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-4 text-xs text-muted-foreground pl-1">
                                            {task.deadline && (
                                                <span className={`flex items-center gap-1 ${isPast(new Date(task.deadline)) && !isToday(new Date(task.deadline)) && task.status !== 'DONE' ? 'text-red-500 font-bold' : ''}`}>
                                                    <Calendar className="h-3 w-3" />
                                                    {format(new Date(task.deadline), 'dd/MM/yyyy')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Badge className={`text-[10px] h-5 w-16 flex items-center justify-center ${getPriorityColor(task.priority)}`}>
                                        {task.priority}
                                    </Badge>

                                    {task.status !== 'DONE' && (
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
                                            </SelectContent>
                                        </Select>
                                    )}

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
