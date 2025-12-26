"use client"


import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { Trash2, Calendar, Plus, MoreVertical, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { format, isPast, isToday } from "date-fns"
import { TaskDetailDialog } from "./TaskDetailDialog"
import { CreateTaskDialog } from "./CreateTaskDialog"

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
        description: string | null;
        assignees: Array<{ id: string; name: string | null }>;
        checklist: Array<{ id: string; text: string; isDone: boolean }>;
        subtasks?: Array<{ id: string; title: string; isDone: boolean }>;
    }>
    users: User[]
    isAdmin: boolean
    currentUserId?: string
    tasksWithActiveTimers?: Record<string, Array<{ id: string; name: string | null }>> // Map of task IDs to users actively working on them
}

export function TasksView({ initialTasks, users, isAdmin, currentUserId, tasksWithActiveTimers = {} }: TasksViewProps) {
    const router = useRouter()
    const [tasks, setTasks] = useState(initialTasks)
    const [filterUserId, setFilterUserId] = useState<string>("all")
    const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null)
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
    const [localSubtasks, setLocalSubtasks] = useState<Record<string, Array<{ id: string; title: string; isDone: boolean }>>>({})
    const subtaskInputRef = useRef<HTMLInputElement | null>(null)
    const pendingOperations = useRef<Set<string>>(new Set()) // Track pending operations by subtask ID
    const [selectedTask, setSelectedTask] = useState<TasksViewProps['initialTasks'][0] | null>(null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [taskTimeEntries, setTaskTimeEntries] = useState<Array<{
        id: string
        startTime: Date | string
        endTime: Date | string | null
        description: string | null
        user: { id: string; name: string | null }
    }>>([])
    const [editingTask, setEditingTask] = useState<TasksViewProps['initialTasks'][0] | null>(null)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

    // Sync local state when server data changes (e.g., after task creation)
    useEffect(() => {
        setTasks(initialTasks)
        // Sync subtasks from server data
        const subtasksMap: Record<string, Array<{ id: string; title: string; isDone: boolean }>> = {}
        initialTasks.forEach(task => {
            if (task.subtasks && task.subtasks.length > 0) {
                subtasksMap[task.id] = task.subtasks
            }
        })
        setLocalSubtasks(subtasksMap)
    }, [initialTasks])

    // Filter tasks
    const filteredTasks = tasks.filter(task => {
        if (filterUserId === "all") return true
        if (task.assignees && task.assignees.length > 0) {
            return task.assignees.some((a) => a.id === filterUserId)
        }
        return false
    })


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

        // Store the deleted task for potential revert
        const deletedTask = tasks.find(t => t.id === id)
        
        // Optimistic update: Remove immediately from UI
        setTasks(prev => prev.filter(t => t.id !== id))
        
        // Also remove from local subtasks if any
        setLocalSubtasks(prev => {
            const newSubtasks = { ...prev }
            delete newSubtasks[id]
            return newSubtasks
        })


        // Fire and forget - API call in background
        fetch(`/api/tasks?id=${id}`, { method: "DELETE" })
            .then((res) => {
                if (!res.ok) {
                    throw new Error("Failed to delete task")
                }
                router.refresh()
            })
            .catch((error) => {
                console.error("Failed to delete task:", error)
                // Revert on error - restore the task
                if (deletedTask) {
                    setTasks(prev => [...prev, deletedTask].sort((a, b) => {
                        // Try to maintain original order
                        const originalIndex = initialTasks.findIndex(t => t.id === a.id)
                        const bIndex = initialTasks.findIndex(t => t.id === b.id)
                        if (originalIndex === -1) return 1
                        if (bIndex === -1) return -1
                        return originalIndex - bIndex
                    }))
                }
                alert("Failed to delete task. Please try again.")
            })
    }

    const openTaskDetail = async (task: TasksViewProps['initialTasks'][0]) => {
        // Set the task first
        setSelectedTask(task)
        
        try {
            // Fetch time entries first, then open dialog
            const res = await fetch(`/api/tasks/${task.id}/time-entries`)
            if (res.ok) {
                const entries = await res.json()
                setTaskTimeEntries(entries)
            } else {
                setTaskTimeEntries([])
            }
        } catch (error) {
            console.error("Failed to fetch time entries:", error)
            setTaskTimeEntries([])
        } finally {
            // Open dialog only after data is loaded
            setIsDetailOpen(true)
        }
    }

    const handleAddSubtask = async (taskId: string) => {
        const trimmedTitle = newSubtaskTitle.trim()
        if (!trimmedTitle) return

        const tempId = `temp-${Date.now()}-${Math.random()}`
        const titleToSave = trimmedTitle
        
        // Clear input IMMEDIATELY - keep input field open for rapid entry
        setNewSubtaskTitle("")
        
        // Optimistic update: Add immediately with temporary ID - synchronous, no await
        setLocalSubtasks(prev => ({
            ...prev,
            [taskId]: [...(prev[taskId] || []), { id: tempId, title: titleToSave, isDone: false }]
        }))

        // Fire and forget - don't await, let it happen in background
        fetch("/api/tasks/subtasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId: taskId, title: titleToSave })
        })
        .then(async (res) => {
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error 
                    ? `${error.message}: ${error.error}` 
                    : error.message || "Failed to create subtask")
            }
            return res.json()
        })
        .then((newSubtask) => {
            // Replace temporary subtask with real one from server
            setLocalSubtasks(prev => ({
                ...prev,
                [taskId]: (prev[taskId] || []).map(s => 
                    s.id === tempId ? { id: newSubtask.id, title: newSubtask.title, isDone: newSubtask.isDone || false } : s
                )
            }))
            router.refresh()
        })
        .catch((error) => {
            console.error("Failed to add subtask:", error)
            // Revert optimistic update on error
            setLocalSubtasks(prev => ({
                ...prev,
                [taskId]: (prev[taskId] || []).filter(s => s.id !== tempId)
            }))
            alert(error instanceof Error ? error.message : "Failed to add subtask")
        })
    }

    const handleToggleSubtask = async (taskId: string, subtaskId: string, currentDone: boolean) => {
        // Skip if operation is already pending
        if (pendingOperations.current.has(subtaskId)) {
            return
        }

        pendingOperations.current.add(subtaskId)
        const newDoneState = !currentDone

        // Optimistic update
        setLocalSubtasks(prev => {
            const taskSubtasks = prev[taskId] || []
            // Check if subtask still exists (might have been deleted)
            const subtaskExists = taskSubtasks.some(s => s.id === subtaskId)
            if (!subtaskExists) {
                pendingOperations.current.delete(subtaskId)
                return prev
            }
            return {
                ...prev,
                [taskId]: taskSubtasks.map(s => 
                    s.id === subtaskId ? { ...s, isDone: newDoneState } : s
                )
            }
        })

        try {
            const res = await fetch("/api/tasks/subtasks", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: subtaskId, isDone: newDoneState })
            })

            if (!res.ok) {
                throw new Error("Failed to update subtask")
            }

            router.refresh()
        } catch (error) {
            console.error("Failed to toggle subtask:", error)
            // Revert on error only if subtask still exists
            setLocalSubtasks(prev => {
                const taskSubtasks = prev[taskId] || []
                const subtaskExists = taskSubtasks.some(s => s.id === subtaskId)
                if (!subtaskExists) {
                    return prev // Don't revert if it was deleted
                }
                return {
                    ...prev,
                    [taskId]: taskSubtasks.map(s => 
                        s.id === subtaskId ? { ...s, isDone: currentDone } : s
                    )
                }
            })
        } finally {
            pendingOperations.current.delete(subtaskId)
        }
    }

    const handleDeleteSubtask = async (taskId: string, subtaskId: string) => {
        // Skip if operation is already pending
        if (pendingOperations.current.has(subtaskId)) {
            return
        }

        pendingOperations.current.add(subtaskId)

        // Store previous state for potential revert
        const previousSubtasks = localSubtasks[taskId] || []
        const deletedSubtask = previousSubtasks.find(s => s.id === subtaskId)

        // Optimistic update - remove immediately
        setLocalSubtasks(prev => ({
            ...prev,
            [taskId]: (prev[taskId] || []).filter(s => s.id !== subtaskId)
        }))

        try {
            const res = await fetch(`/api/tasks/subtasks?id=${subtaskId}`, { method: "DELETE" })
            if (!res.ok) {
                throw new Error("Failed to delete subtask")
            }
            router.refresh()
        } catch (error) {
            console.error("Failed to delete subtask:", error)
            // Revert on error - restore the deleted subtask
            if (deletedSubtask) {
                setLocalSubtasks(prev => ({
                    ...prev,
                    [taskId]: [...(prev[taskId] || []), deletedSubtask].sort((a, b) => {
                        // Try to maintain original order
                        const aIndex = previousSubtasks.findIndex(s => s.id === a.id)
                        const bIndex = previousSubtasks.findIndex(s => s.id === b.id)
                        if (aIndex === -1) return 1
                        if (bIndex === -1) return -1
                        return aIndex - bIndex
                    })
                }))
            }
        } finally {
            pendingOperations.current.delete(subtaskId)
        }
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
                                        {user.name || user.email} {user.id === currentUserId && "(you)"}
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
                                <div className="flex items-start gap-3 flex-1 group">
                                    <Checkbox
                                        checked={task.status === 'DONE'}
                                        onCheckedChange={(checked) => handleCheckboxChange(task.id, task.status, checked as boolean)}
                                        className="mt-1"
                                    />
                                    <div className="space-y-1 flex-1">
                                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => openTaskDetail(task)}>
                                            <span className={`text-sm font-medium group-hover:text-primary transition-colors ${task.status === 'DONE' ? 'line-through text-muted-foreground' : ''}`}>
                                                {task.title}
                                            </span>
                                            {task.checklist && task.checklist.length > 0 && (
                                                <Badge variant="outline" className="text-[10px] h-5 px-2 text-muted-foreground border-muted-foreground/30">
                                                    {task.checklist.filter(i => i.isDone).length}/{task.checklist.length}
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Assign To */}
                                        {task.assignees && task.assignees.length > 0 && (
                                            <div className="pl-1">
                                                <span className="text-xs text-muted-foreground">
                                                    Assign to: {task.assignees.map(a => a.name || 'Unknown').join(', ')}
                                                </span>
                                            </div>
                                        )}

                                        {/* Status: To Do / In Progress */}
                                        <div className="pl-1">
                                            <span className="text-xs text-muted-foreground">
                                                Status: {task.status === 'DONE' 
                                                    ? 'Done' 
                                                    : (() => {
                                                        const activeUsers = tasksWithActiveTimers[task.id]
                                                        return activeUsers && activeUsers.length > 0
                                                            ? `In Progress by ${activeUsers.map(u => u.name || 'Unknown').join(', ')}`
                                                            : 'To Do'
                                                    })()}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-4 text-xs text-muted-foreground pl-1">
                                            {task.deadline && (
                                                <span className={`flex items-center gap-1 ${isPast(new Date(task.deadline)) && !isToday(new Date(task.deadline)) && task.status !== 'DONE' ? 'text-red-500 font-bold' : ''}`}>
                                                    <Calendar className="h-3 w-3" />
                                                    {format(new Date(task.deadline), 'dd/MM/yyyy')}
                                                </span>
                                            )}
                                        </div>

                                        {/* Subtasks Display - Under task title */}
                                        {(localSubtasks[task.id] && localSubtasks[task.id].length > 0) && (
                                            <div className="pl-3 mt-2 space-y-1.5 border-l-2 border-muted/50">
                                                {localSubtasks[task.id].map((subtask) => (
                                                    <div key={subtask.id} className="flex items-center gap-2 group/subtask">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-5 w-5 opacity-0 group-hover/subtask:opacity-100 text-muted-foreground hover:text-destructive"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleDeleteSubtask(task.id, subtask.id)
                                                            }}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                        <Checkbox
                                                            checked={subtask.isDone}
                                                            onCheckedChange={() => handleToggleSubtask(task.id, subtask.id, subtask.isDone)}
                                                            className="h-4 w-4"
                                                        />
                                                        <span className={`text-xs flex-1 ${subtask.isDone ? 'line-through text-muted-foreground opacity-70' : 'text-muted-foreground'}`}>
                                                            {subtask.title}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Add SubTask Button and Input - Under task title */}
                                        <div className="flex flex-col gap-2 pl-1 mt-1">
                                            {addingSubtaskTo === task.id ? (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        placeholder="Subtask title..."
                                                        value={newSubtaskTitle}
                                                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter" && newSubtaskTitle.trim()) {
                                                                e.preventDefault()
                                                                const inputElement = e.currentTarget
                                                                handleAddSubtask(task.id)
                                                                // Refocus input immediately for rapid entry
                                                                requestAnimationFrame(() => {
                                                                    if (inputElement && document.body.contains(inputElement)) {
                                                                        inputElement.focus()
                                                                    }
                                                                })
                                                            } else if (e.key === "Escape") {
                                                                setAddingSubtaskTo(null)
                                                                setNewSubtaskTitle("")
                                                            }
                                                        }}
                                                        className="h-8 text-sm"
                                                        autoFocus
                                                    />
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            handleAddSubtask(task.id)
                                                            // Refocus input immediately for rapid entry
                                                            requestAnimationFrame(() => {
                                                                if (subtaskInputRef.current && document.body.contains(subtaskInputRef.current)) {
                                                                    subtaskInputRef.current.focus()
                                                                }
                                                            })
                                                        }}
                                                        disabled={!newSubtaskTitle.trim()}
                                                        className="h-8"
                                                    >
                                                        Add
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            setAddingSubtaskTo(null)
                                                            setNewSubtaskTitle("")
                                                        }}
                                                        className="h-8"
                                                    >
                                                        Cancel
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setAddingSubtaskTo(task.id)
                                                    }}
                                                    className="h-7 text-xs text-muted-foreground hover:text-foreground w-fit"
                                                >
                                                    <Plus className="h-3 w-3 mr-1" />
                                                    Add SubTask
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Badge className={`text-[10px] h-6 px-2 flex items-center justify-center ${getPriorityColor(task.priority)}`}>
                                        {task.priority}
                                    </Badge>
                                    {(isAdmin || (currentUserId && task.assignees.some(a => a.id === currentUserId))) && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => {
                                                    setEditingTask(task)
                                                    setIsEditDialogOpen(true)
                                                }}>
                                                    <Pencil className="h-4 w-4 mr-2" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                    onClick={() => handleDelete(task.id)}
                                                    className="text-destructive focus:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>

            <TaskDetailDialog
                task={selectedTask}
                open={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                timeEntries={taskTimeEntries}
            />

            <CreateTaskDialog
                users={users}
                task={editingTask || undefined}
                mode="edit"
                open={isEditDialogOpen}
                onOpenChange={(open) => {
                    setIsEditDialogOpen(open)
                    if (!open) {
                        setEditingTask(null)
                    }
                }}
                onTaskCreated={() => {
                    router.refresh()
                }}
            />
        </Card>
    )
}
