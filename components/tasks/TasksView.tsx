"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Task {
    id: string
    title: string
    isCompleted: boolean
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
    initialTasks: Task[]
    users: User[] // Empty if not admin
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

    const handleToggle = async (id: string, currentStatus: boolean) => {
        setLoadingId(id)
        await fetch("/api/tasks", {
            method: "PATCH",
            body: JSON.stringify({ id, isCompleted: !currentStatus }),
        })
        router.refresh()
        setLoadingId(null)
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return
        await fetch(`/api/tasks?id=${id}`, { method: "DELETE" })
        router.refresh()
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
                            <div key={task.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                <div className="flex items-center space-x-3">
                                    <Checkbox
                                        id={task.id}
                                        checked={task.isCompleted}
                                        onCheckedChange={() => handleToggle(task.id, task.isCompleted)}
                                        disabled={loadingId === task.id}
                                    />
                                    <div className="grid gap-1.5 leading-none">
                                        <label
                                            htmlFor={task.id}
                                            className={`text-sm font-medium leading-none cursor-pointer ${task.isCompleted ? 'line-through text-muted-foreground' : ''}`}
                                        >
                                            {task.title}
                                        </label>
                                        {isAdmin && (
                                            <p className="text-xs text-muted-foreground">
                                                Assigned to: {task.assignedTo.name || task.assignedTo.email}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {isAdmin && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(task.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
