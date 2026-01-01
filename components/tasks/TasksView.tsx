"use client"


import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { Trash2, Calendar, Plus, MoreVertical, Pencil, Play, CheckCircle2, AlertCircle, Timer, ArrowUp, ArrowDown, Minus } from "lucide-react"
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
import { format, isPast, isToday, endOfWeek, isWithinInterval } from "date-fns"
import { TaskDetailDialog } from "./TaskDetailDialog"
import { CreateTaskDialog } from "./CreateTaskDialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Filter, X, ArrowUpDown } from "lucide-react"
import { useLanguage } from "@/lib/useLanguage"

const getPriorityColor = (priority: string) => {
    // Dynamic theme-based colors using CSS variables (handled by Tailwind)
    // High: Solid primary color
    // Medium: 80% opacity primary
    // Low: 60% opacity primary
    switch (priority) {
        case 'HIGH':
            return 'bg-primary text-primary-foreground border-transparent'
        case 'MEDIUM':
            return 'bg-primary/80 text-primary-foreground border-transparent'
        case 'LOW':
            return 'bg-primary/60 text-primary-foreground border-transparent'
        default:
            return 'bg-muted text-muted-foreground border-border'
    }
}

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
        createdAt?: Date | string;
    }>
    users: User[]
    isAdmin: boolean
    currentUserId?: string
    tasksWithActiveTimers?: Record<string, Array<{ id: string; name: string | null }>> // Map of task IDs to users actively working on them
}

export function TasksView({ initialTasks, users, isAdmin, currentUserId, tasksWithActiveTimers = {} }: TasksViewProps) {
    const router = useRouter()
    const { t, isRTL } = useLanguage()
    const [tasks, setTasks] = useState(initialTasks)
    const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null)
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
    const [editingSubtask, setEditingSubtask] = useState<{ taskId: string; subtaskId: string } | null>(null)
    const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("")

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
        subtaskId: string | null
        subtask?: { id: string; title: string } | null
        user: { id: string; name: string | null }
    }>>([])
    const [editingTask, setEditingTask] = useState<TasksViewProps['initialTasks'][0] | null>(null)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

    // Filters and Sort state
    const [isFiltersOpen, setIsFiltersOpen] = useState(false)
    const [filters, setFilters] = useState<{
        status: string[];
        deadline: string[];
        priority: string[];
        createdByMe: boolean;
        assignedToMe: boolean;
        users: string[];
    }>({
        status: [],
        deadline: [],
        priority: [],
        createdByMe: false,
        assignedToMe: false,
        users: [],
    })
    const [sortBy, setSortBy] = useState<string>("smart")

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



    // Apply filters
    const applyFilters = (task: TasksViewProps['initialTasks'][0]) => {
        // Status filter
        if (filters.status.length > 0) {
            const taskStatus = task.status === 'DONE' ? 'DONE' :
                (tasksWithActiveTimers[task.id] && tasksWithActiveTimers[task.id].length > 0 ? 'IN_PROGRESS' : 'TODO')
            const isOverdue = task.deadline && isPast(new Date(task.deadline)) && !isToday(new Date(task.deadline)) && task.status !== 'DONE'
            const statusToCheck = isOverdue ? 'OVERDUE' : taskStatus

            if (!filters.status.includes(statusToCheck) && !filters.status.includes(taskStatus)) {
                return false
            }
        }

        // Deadline filter
        if (filters.deadline.length > 0 && task.deadline) {
            const deadline = new Date(task.deadline)
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const weekEnd = endOfWeek(today, { weekStartsOn: 0 })

            let matchesDeadline = false
            if (filters.deadline.includes('today') && isToday(deadline)) {
                matchesDeadline = true
            }
            if (filters.deadline.includes('overdue') && isPast(deadline) && !isToday(deadline)) {
                matchesDeadline = true
            }
            if (filters.deadline.includes('thisWeek') && isWithinInterval(deadline, { start: today, end: weekEnd })) {
                matchesDeadline = true
            }
            if (!matchesDeadline) {
                return false
            }
        } else if (filters.deadline.length > 0 && !task.deadline) {
            // If filtering by deadline but task has no deadline, exclude it
            return false
        }

        // Priority filter
        if (filters.priority.length > 0) {
            const priorityMap: Record<string, string[]> = {
                'high': ['HIGH'],
                'medium': ['MEDIUM'],
                'low': ['LOW']
            }
            const matchesPriority = filters.priority.some(filterPriority => {
                const priorities = priorityMap[filterPriority] || []
                return priorities.includes(task.priority)
            })
            if (!matchesPriority) {
                return false
            }
        }

        // Assigned to me filter
        if (filters.assignedToMe && currentUserId) {
            if (!task.assignees || !task.assignees.some(a => a.id === currentUserId)) {
                return false
            }
        }

        // Users filter
        if (filters.users.length > 0) {
            if (!task.assignees || !task.assignees.some(a => filters.users.includes(a.id))) {
                return false
            }
        }

        // Created by me filter (we'll skip this for now as we don't have creatorId)

        return true
    }

    // Apply sorting
    const applySort = (a: TasksViewProps['initialTasks'][0], b: TasksViewProps['initialTasks'][0]) => {
        switch (sortBy) {
            case 'smart': {
                // Smart sort: new tasks first (by createdAt), then deadline today + high priority
                // First, sort by creation date (newest first) if both have createdAt
                if (a.createdAt && b.createdAt) {
                    const aCreated = new Date(a.createdAt).getTime()
                    const bCreated = new Date(b.createdAt).getTime()
                    // Newer tasks first
                    if (aCreated !== bCreated) {
                        return bCreated - aCreated
                    }
                } else if (a.createdAt && !b.createdAt) {
                    return -1 // a is newer
                } else if (!a.createdAt && b.createdAt) {
                    return 1 // b is newer
                }

                // Then by deadline today + high priority
                const aDeadline = a.deadline ? new Date(a.deadline) : null
                const bDeadline = b.deadline ? new Date(b.deadline) : null
                const aIsToday = aDeadline && isToday(aDeadline)
                const bIsToday = bDeadline && isToday(bDeadline)
                const aIsHigh = a.priority === 'HIGH'
                const bIsHigh = b.priority === 'HIGH'

                // Priority: today + high > today > high > others
                if (aIsToday && aIsHigh && !(bIsToday && bIsHigh)) return -1
                if (bIsToday && bIsHigh && !(aIsToday && aIsHigh)) return 1
                if (aIsToday && !bIsToday) return -1
                if (bIsToday && !aIsToday) return 1
                if (aIsHigh && !bIsHigh) return -1
                if (bIsHigh && !aIsHigh) return 1
                // Then by deadline proximity
                if (aDeadline && bDeadline) {
                    return aDeadline.getTime() - bDeadline.getTime()
                }
                if (aDeadline) return -1
                if (bDeadline) return 1
                return 0
            }
            case 'deadline-near': {
                const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Infinity
                const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Infinity
                return aDeadline - bDeadline
            }
            case 'deadline-far': {
                const aDeadline = a.deadline ? new Date(a.deadline).getTime() : -Infinity
                const bDeadline = b.deadline ? new Date(b.deadline).getTime() : -Infinity
                return bDeadline - aDeadline
            }
            case 'priority-high': {
                const priorityOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 }
                const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 3
                const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 3
                return aPriority - bPriority
            }
            case 'priority-low': {
                const priorityOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 }
                const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 3
                const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 3
                return bPriority - aPriority
            }
            case 'created-new': {
                const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0
                const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0
                return bCreated - aCreated
            }
            case 'created-old': {
                const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0
                const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0
                return aCreated - bCreated
            }
            default:
                return 0
        }
    }

    // Filter and sort tasks
    const filteredTasks = tasks
        .filter(applyFilters)
        .sort(applySort)

    // Count active filters
    const activeFiltersCount =
        filters.status.length +
        filters.deadline.length +
        filters.priority.length +
        filters.users.length +
        (filters.createdByMe ? 1 : 0) +
        (filters.assignedToMe ? 1 : 0)

    const clearAllFilters = () => {
        setFilters({
            status: [],
            deadline: [],
            priority: [],
            createdByMe: false,
            assignedToMe: false,
            users: [],
        })
    }

    const getFilterLabel = (type: string, value: string) => {
        if (type === 'status') {
            const labels: Record<string, string> = {
                'TODO': 'Open',
                'IN_PROGRESS': 'In Progress',
                'DONE': 'Completed',
                'OVERDUE': 'Overdue'
            }
            return labels[value] || value
        }
        if (type === 'deadline') {
            const labels: Record<string, string> = {
                'today': 'Today',
                'thisWeek': 'This week',
                'overdue': 'Overdue'
            }
            return labels[value] || value
        }
        if (type === 'priority') {
            const labels: Record<string, string> = {
                'high': 'High',
                'medium': 'Medium',
                'low': 'Low'
            }
            return labels[value] || value
        }
        if (type === 'users') {
            const user = users.find(u => u.id === value)
            return user?.name || user?.email || value
        }
        return value
    }


    const handleCheckboxChange = async (id: string, currentStatus: string, checked: boolean) => {
        // Optimistic update
        const newStatus = checked ? 'DONE' : (currentStatus === 'DONE' ? 'TODO' : currentStatus)
        const previousTasks = tasks
        setTasks(tasks.map(t => t.id === id ? { ...t, status: newStatus } : t))

        // If marking task as done, mark all subtasks as done
        // If unmarking task, unmark all subtasks
        if (checked) {
            // Mark all subtasks as done
            const taskSubtasks = localSubtasks[id] || []
            if (taskSubtasks.length > 0) {
                // Optimistic update for all subtasks
                setLocalSubtasks(prev => ({
                    ...prev,
                    [id]: taskSubtasks.map(s => ({ ...s, isDone: true }))
                }))

                // Update all subtasks in background
                Promise.all(
                    taskSubtasks.map(subtask =>
                        fetch("/api/tasks/subtasks", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: subtask.id, isDone: true })
                        }).catch(err => {
                            console.error(`Failed to update subtask ${subtask.id}:`, err)
                            // Revert this specific subtask on error
                            setLocalSubtasks(prev => ({
                                ...prev,
                                [id]: (prev[id] || []).map(s =>
                                    s.id === subtask.id ? { ...s, isDone: subtask.isDone } : s
                                )
                            }))
                        })
                    )
                )
            }
        } else {
            // Unmark all subtasks
            const taskSubtasks = localSubtasks[id] || []
            if (taskSubtasks.length > 0) {
                // Optimistic update for all subtasks
                setLocalSubtasks(prev => ({
                    ...prev,
                    [id]: taskSubtasks.map(s => ({ ...s, isDone: false }))
                }))

                // Update all subtasks in background
                Promise.all(
                    taskSubtasks.map(subtask =>
                        fetch("/api/tasks/subtasks", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: subtask.id, isDone: false })
                        }).catch(err => {
                            console.error(`Failed to update subtask ${subtask.id}:`, err)
                            // Revert this specific subtask on error
                            setLocalSubtasks(prev => ({
                                ...prev,
                                [id]: (prev[id] || []).map(s =>
                                    s.id === subtask.id ? { ...s, isDone: subtask.isDone } : s
                                )
                            }))
                        })
                    )
                )
            }
        }

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
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    throw new Error(data.message || "Failed to delete task")
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
                alert(error.message || "Failed to delete task. Please try again.")
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

    const handleToggleSubtask = (taskId: string, subtaskId: string, currentDone: boolean) => {
        const newDoneState = !currentDone

        // Optimistic update - INSTANT visual feedback
        setLocalSubtasks(prev => {
            const taskSubtasks = prev[taskId] || []
            // Check if subtask still exists (might have been deleted)
            const subtaskExists = taskSubtasks.some(s => s.id === subtaskId)
            if (!subtaskExists) {
                return prev
            }
            const updatedSubtasks = taskSubtasks.map(s =>
                s.id === subtaskId ? { ...s, isDone: newDoneState } : s
            )

            // Check if all subtasks are now done
            const allDone = updatedSubtasks.length > 0 && updatedSubtasks.every(s => s.isDone)
            // Check if any subtask is not done
            const anyNotDone = updatedSubtasks.some(s => !s.isDone)

            // Update main task status based on subtasks
            if (allDone) {
                // All subtasks are done - mark main task as DONE
                setTasks(prev => prev.map(t =>
                    t.id === taskId && t.status !== 'DONE' ? { ...t, status: 'DONE' } : t
                ))
                // Update task status in background
                fetch("/api/tasks", {
                    method: "PATCH",
                    body: JSON.stringify({ id: taskId, status: 'DONE' }),
                }).catch(err => console.error("Failed to update task status:", err))
            } else if (anyNotDone) {
                // At least one subtask is not done - unmark main task if it was DONE
                setTasks(prev => prev.map(t =>
                    t.id === taskId && t.status === 'DONE' ? { ...t, status: 'TODO' } : t
                ))
                // Update task status in background
                fetch("/api/tasks", {
                    method: "PATCH",
                    body: JSON.stringify({ id: taskId, status: 'TODO' }),
                }).catch(err => console.error("Failed to update task status:", err))
            }

            return {
                ...prev,
                [taskId]: updatedSubtasks
            }
        })

        // API call happens in background - doesn't block UI
        // Use a unique key to track this specific operation
        const operationKey = `${subtaskId}-${Date.now()}`
        pendingOperations.current.add(operationKey)

        fetch("/api/tasks/subtasks", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: subtaskId, isDone: newDoneState })
        })
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error("Failed to update subtask")
                }
                // Refresh in background after successful update
                router.refresh()
            })
            .catch((error) => {
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
            })
            .finally(() => {
                // Remove from pending operations after a short delay
                setTimeout(() => {
                    pendingOperations.current.delete(operationKey)
                }, 500)
            })
    }

    const handleEditSubtask = async (taskId: string, subtaskId: string, newTitle: string) => {
        const trimmedTitle = newTitle.trim()
        if (!trimmedTitle) {
            setEditingSubtask(null)
            return
        }

        // Store previous state for potential revert
        const previousSubtasks = localSubtasks[taskId] || []
        const previousSubtask = previousSubtasks.find(s => s.id === subtaskId)

        // Optimistic update
        setLocalSubtasks(prev => ({
            ...prev,
            [taskId]: (prev[taskId] || []).map(s =>
                s.id === subtaskId ? { ...s, title: trimmedTitle } : s
            )
        }))

        setEditingSubtask(null)

        try {
            const res = await fetch("/api/tasks/subtasks", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: subtaskId, title: trimmedTitle })
            })

            if (!res.ok) {
                throw new Error("Failed to update subtask")
            }

            router.refresh()
        } catch (error) {
            console.error("Failed to update subtask:", error)
            // Revert on error
            if (previousSubtask) {
                setLocalSubtasks(prev => ({
                    ...prev,
                    [taskId]: (prev[taskId] || []).map(s =>
                        s.id === subtaskId ? previousSubtask : s
                    )
                }))
            }
        }
    }

    const handleStartWorking = async (taskId: string, subtaskId?: string) => {
        try {
            // Start timer with the task
            const response = await fetch('/api/time-entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start',
                    taskIds: [taskId],
                    subtaskId: subtaskId || null
                })
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.message || 'Failed to start timer')
            }

            // Navigate to dashboard (time tracker screen)
            router.push('/dashboard')
        } catch (error) {
            console.error('Failed to start working:', error)
            alert(error instanceof Error ? error.message : 'Failed to start timer')
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



    return (

        <Card className="border-none shadow-none">
            <CardHeader className="flex flex-col space-y-4 pb-4 px-0">
                {/* Filters and Sort - Above title */}
                <div className={`flex items-center gap-2 w-full ${isRTL ? 'flex-row-reverse justify-start' : 'justify-end'}`}>
                    {/* Filters Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsFiltersOpen(true)}
                        className={`h-9 text-sm font-medium flex-1 md:flex-initial ${isRTL ? 'flex-row-reverse' : ''}`}
                    >
                        <Filter className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                        {t('tasks.filters')}
                        {activeFiltersCount > 0 && (
                            <Badge variant="secondary" className={`h-5 px-1.5 text-xs ${isRTL ? 'mr-2' : 'ml-2'}`}>
                                {activeFiltersCount}
                            </Badge>
                        )}
                    </Button>

                    {/* Sort Dropdown */}
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="h-9 text-sm font-medium px-3 w-auto">
                            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <ArrowUpDown className="h-4 w-4" />
                                <SelectValue placeholder={t('tasks.sort')} />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="smart">{t('tasks.sort')}</SelectItem>
                            <SelectItem value="deadline-near">By deadline: Closest → Farthest</SelectItem>
                            <SelectItem value="deadline-far">By deadline: Farthest → Closest</SelectItem>
                            <SelectItem value="priority-high">By priority: High → Low</SelectItem>
                            <SelectItem value="priority-low">By priority: Low → High</SelectItem>
                            <SelectItem value="created-new">By time: Newest → Oldest</SelectItem>
                            <SelectItem value="created-old">By time: Oldest → Newest</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Title */}
                <CardTitle className={`px-4 ${isRTL ? 'text-right' : 'text-left'}`}>{t('tasks.allTasks')} ({filteredTasks.length})</CardTitle>

                {/* Active Filter Chips */}
                {activeFiltersCount > 0 && (
                    <div className="flex flex-wrap gap-1.5 items-center px-4">
                        {filters.status.map(status => (
                            <Badge key={status} variant="secondary" className="h-6 text-xs px-2">
                                {getFilterLabel('status', status)}
                                <button
                                    onClick={() => setFilters(prev => ({
                                        ...prev,
                                        status: prev.status.filter(s => s !== status)
                                    }))}
                                    className="ml-1.5 hover:bg-muted-foreground/20 rounded-full p-0.5"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                        {filters.deadline.map(deadline => (
                            <Badge key={deadline} variant="secondary" className="h-6 text-xs px-2">
                                {getFilterLabel('deadline', deadline)}
                                <button
                                    onClick={() => setFilters(prev => ({
                                        ...prev,
                                        deadline: prev.deadline.filter(d => d !== deadline)
                                    }))}
                                    className="ml-1.5 hover:bg-muted-foreground/20 rounded-full p-0.5"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                        {filters.priority.map(priority => (
                            <Badge key={priority} variant="secondary" className="h-6 text-xs px-2">
                                {getFilterLabel('priority', priority)}
                                <button
                                    onClick={() => setFilters(prev => ({
                                        ...prev,
                                        priority: prev.priority.filter(p => p !== priority)
                                    }))}
                                    className="ml-1.5 hover:bg-muted-foreground/20 rounded-full p-0.5"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                        {filters.users.map(userId => (
                            <Badge key={userId} variant="secondary" className="h-6 text-xs px-2">
                                {getFilterLabel('users', userId)}
                                <button
                                    onClick={() => setFilters(prev => ({
                                        ...prev,
                                        users: prev.users.filter(u => u !== userId)
                                    }))}
                                    className="ml-1.5 hover:bg-muted-foreground/20 rounded-full p-0.5"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                        {filters.assignedToMe && (
                            <Badge variant="secondary" className="h-6 text-xs px-2">
                                Assigned to me
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, assignedToMe: false }))}
                                    className="ml-1.5 hover:bg-muted-foreground/20 rounded-full p-0.5"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        )}
                        {filters.createdByMe && (
                            <Badge variant="secondary" className="h-6 text-xs px-2">
                                Tasks I created
                                <button
                                    onClick={() => setFilters(prev => ({ ...prev, createdByMe: false }))}
                                    className="ml-1.5 hover:bg-muted-foreground/20 rounded-full p-0.5"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        )}
                        {activeFiltersCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearAllFilters}
                                className="h-6 text-xs px-2"
                            >
                                {t('common.clearAll')}
                            </Button>
                        )}
                    </div>
                )}
            </CardHeader>
            <CardContent className="p-0">
                <div className="w-full overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b border-border/50">
                                {/* Task Title - Flexible width */}
                                <th className="h-10 px-4 text-left font-normal text-muted-foreground bg-muted/20 first:rounded-tl-lg">
                                    {t('tasks.title') || 'Task'}
                                </th>
                                {/* Assigned To */}
                                <th className="h-10 px-4 text-left font-normal text-muted-foreground w-[150px] bg-muted/20">
                                    {t('tasks.assignToLabel') || 'Assigned to'}
                                </th>
                                {/* Status */}
                                <th className="h-10 px-4 text-center font-normal text-muted-foreground w-[140px] bg-muted/20">
                                    {t('tasks.status')}
                                </th>
                                {/* Priority */}
                                <th className="h-10 px-4 text-center font-normal text-muted-foreground w-[140px] bg-muted/20">
                                    {t('tasks.priority') || 'Priority'}
                                </th>
                                {/* Deadline */}
                                <th className="h-10 px-4 text-center font-normal text-muted-foreground w-[150px] bg-muted/20">
                                    {t('tasks.deadline') || 'Deadline'}
                                </th>
                                {/* Actions */}
                                <th className="h-10 px-4 w-[50px] bg-muted/20 last:rounded-tr-lg"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTasks.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-muted-foreground italic">
                                        No tasks found.
                                    </td>
                                </tr>
                            ) : (
                                filteredTasks.map((task) => (
                                    <>
                                        {/* Main Task Row */}
                                        <tr
                                            key={task.id}
                                            className="group border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                                        >
                                            {/* Task Title */}
                                            <td className="p-2 align-middle border-e border-border/50">
                                                <div className="flex items-center gap-3">
                                                    {/* Checkbox */}
                                                    <div className="flex items-center justify-center h-full">
                                                        <Checkbox
                                                            checked={task.status === 'DONE'}
                                                            onCheckedChange={(checked) => handleCheckboxChange(task.id, task.status, checked as boolean)}
                                                            className={`h-5 w-5 border-2 transition-all ${task.status === 'DONE' ? 'bg-primary border-primary' : 'border-muted-foreground/40 hover:border-primary/60'}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>

                                                    <div className="flex flex-col flex-1 py-1">
                                                        <div
                                                            className="flex items-center gap-2 cursor-pointer group-hover:text-primary transition-colors"
                                                            onClick={() => openTaskDetail(task)}
                                                        >
                                                            <span className={`text-sm font-medium ${task.status === 'DONE' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                                                {task.title}
                                                            </span>
                                                            {task.checklist && task.checklist.length > 0 && (
                                                                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">
                                                                    {task.checklist.filter(i => i.isDone).length}/{task.checklist.length}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Subtask Stats / Summary in small text if needed */}
                                                        {localSubtasks[task.id] && localSubtasks[task.id].length > 0 && (
                                                            <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                                                                <span className="flex items-center gap-1">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"></span>
                                                                    {localSubtasks[task.id].length} subtasks
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Row Actions - Visible on Hover (Plus Only) */}
                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 px-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setAddingSubtaskTo(task.id)
                                                            }}
                                                            title={t('tasks.addSubTask')}
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>


                                                {/* Inline Subtask Edit/Add */}
                                                {addingSubtaskTo === task.id && (
                                                    <div className="mt-2 pl-8 flex items-center gap-2 pr-4 relative z-10">
                                                        <div className="w-3 h-3 border-l pb-3 border-b border-muted-foreground/30 absolute left-6 top-[-10px]"></div>
                                                        <Input
                                                            ref={subtaskInputRef}
                                                            placeholder="New subtask..."
                                                            value={newSubtaskTitle}
                                                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter" && newSubtaskTitle.trim()) {
                                                                    e.preventDefault();
                                                                    handleAddSubtask(task.id);
                                                                } else if (e.key === "Escape") {
                                                                    setAddingSubtaskTo(null);
                                                                    setNewSubtaskTitle("");
                                                                }
                                                            }}
                                                            className="h-8 text-sm bg-background"
                                                            autoFocus
                                                        />
                                                        <Button size="sm" className="h-8 px-3" onClick={() => handleAddSubtask(task.id)}>Add</Button>
                                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setAddingSubtaskTo(null)}><X className="h-4 w-4" /></Button>
                                                    </div>
                                                )}

                                            </td >

                                            {/* Assigned To */}
                                            < td className="p-2 align-middle" >
                                                <div className="flex -space-x-2 overflow-hidden justify-start pl-2">
                                                    {task.assignees && task.assignees.length > 0 ? (
                                                        task.assignees.map((assignee, i) => (
                                                            <div
                                                                key={assignee.id || i}
                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-muted-foreground ring-offset-background"
                                                                title={assignee.name || 'Unknown'}
                                                            >
                                                                {assignee.name ? assignee.name.substring(0, 2).toUpperCase() : '??'}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="h-8 w-8 flex items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 text-muted-foreground/50 text-[10px]">
                                                            <Plus className="h-3 w-3" />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td className="p-1 align-middle text-center">
                                                <div
                                                    className={`
                                                        h-8 w-full max-w-[140px] mx-auto flex items-center justify-center gap-2 text-xs font-semibold text-white shadow-sm rounded-md transition-all
                                                        ${task.status === 'DONE' ? 'bg-[#00c875] hover:bg-[#00c875]/90' : ''} 
                                                        ${(tasksWithActiveTimers[task.id] && tasksWithActiveTimers[task.id].length > 0) ? 'bg-[#fdab3d] hover:bg-[#fdab3d]/90' : ''}
                                                        ${task.status === 'TODO' && !((tasksWithActiveTimers[task.id] && tasksWithActiveTimers[task.id].length > 0)) ? 'bg-[#c4c4c4] hover:bg-[#b0b0b0]' : ''} 
                                                        ${isPast(new Date(task.deadline || '')) && !isToday(new Date(task.deadline || '')) && task.status !== 'DONE' ? 'bg-[#e2445c] hover:bg-[#d00000]' : ''}
                                                    `}
                                                >
                                                    {task.status === 'DONE' && <CheckCircle2 className="h-3.5 w-3.5" />}
                                                    {(tasksWithActiveTimers[task.id] && tasksWithActiveTimers[task.id].length > 0) && <Timer className="h-3.5 w-3.5 animate-pulse" />}
                                                    {isPast(new Date(task.deadline || '')) && !isToday(new Date(task.deadline || '')) && task.status !== 'DONE' && <AlertCircle className="h-3.5 w-3.5" />}

                                                    <span className="truncate">
                                                        {task.status === 'DONE' ? 'Done' :
                                                            isPast(new Date(task.deadline || '')) && !isToday(new Date(task.deadline || '')) && task.status !== 'DONE' ? 'Overdue' :
                                                                (tasksWithActiveTimers[task.id] && tasksWithActiveTimers[task.id].length > 0)
                                                                    ? `In Progress by ${tasksWithActiveTimers[task.id][0].name?.split(' ')[0] || 'User'}`
                                                                    : 'TO DO'
                                                        }
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Priority */}
                                            <td className="p-1 align-middle text-center">
                                                <div className={`
                                                    h-8 w-full max-w-[140px] mx-auto flex items-center justify-center gap-1.5 text-xs font-semibold shadow-sm p-2 rounded-md border
                                                    ${getPriorityColor(task.priority)}
                                                `}>
                                                    {task.priority === 'HIGH' && <ArrowUp className="h-3.5 w-3.5" />}
                                                    {task.priority === 'MEDIUM' && <Minus className="h-3.5 w-3.5" />}
                                                    {task.priority === 'LOW' && <ArrowDown className="h-3.5 w-3.5" />}

                                                    {task.priority === 'HIGH' ? 'High' : task.priority === 'MEDIUM' ? 'Medium' : 'Low'}
                                                </div>
                                            </td>

                                            {/* Deadline */}
                                            <td className="p-2 align-middle text-center">
                                                {task.deadline ? (
                                                    <div className={`
                                                        flex items-center justify-center gap-1.5 text-xs h-8 px-2 w-full max-w-[150px] mx-auto
                                                        ${isPast(new Date(task.deadline)) && !isToday(new Date(task.deadline)) && task.status !== 'DONE'
                                                            ? 'text-[#e2445c] font-semibold bg-[#e2445c]/10'
                                                            : 'text-muted-foreground bg-muted/30'}
                                                    `}>
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        {format(new Date(task.deadline), 'MMM d')}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground/30 text-xs">-</span>
                                                )}
                                            </td>

                                            {/* Actions Column */}
                                            <td className="p-2 align-middle text-center">
                                                {(isAdmin || (currentUserId && task.assignees.some(a => a.id === currentUserId))) && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => handleStartWorking(task.id)}>
                                                                <Play className="h-4 w-4 mr-2" />
                                                                {t('tasks.startWorking')}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => {
                                                                setEditingTask(task)
                                                                setIsEditDialogOpen(true)
                                                            }}>
                                                                <Pencil className="h-4 w-4 mr-2" />
                                                                {t('tasks.edit')}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => handleDelete(task.id)}
                                                                className="text-destructive focus:text-destructive"
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                {t('tasks.delete')}
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </td>
                                        </tr>

                                        {/* Nested Subtasks Rendered as Rows */}
                                        {localSubtasks[task.id] && localSubtasks[task.id].length > 0 && (
                                            localSubtasks[task.id].map((subtask) => (
                                                <tr key={subtask.id} className="group/subtask bg-muted/5 hover:bg-muted/10">
                                                    {/* Spacing for Task Title (nested) */}
                                                    <td className="p-2 pl-12 border-e border-border/50">
                                                        <div className="flex items-center gap-2 relative">
                                                            {/* Connector Line */}
                                                            <div className="absolute left-[-16px] top-1/2 w-4 h-[1px] bg-border"></div>
                                                            <div className="absolute left-[-16px] top-[-50%] bottom-1/2 w-[1px] bg-border"></div>

                                                            <Checkbox
                                                                checked={subtask.isDone}
                                                                onCheckedChange={() => handleToggleSubtask(task.id, subtask.id, subtask.isDone)}
                                                                className="h-3.5 w-3.5 opacity-60 data-[state=checked]:opacity-100"
                                                            />

                                                            {editingSubtask?.taskId === task.id && editingSubtask?.subtaskId === subtask.id ? (
                                                                <Input
                                                                    value={editingSubtaskTitle}
                                                                    onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === "Enter") {
                                                                            e.preventDefault()
                                                                            handleEditSubtask(task.id, subtask.id, editingSubtaskTitle)
                                                                        } else if (e.key === "Escape") {
                                                                            setEditingSubtask(null)
                                                                            setEditingSubtaskTitle("")
                                                                        }
                                                                    }}
                                                                    onBlur={() => {
                                                                        if (editingSubtaskTitle.trim()) {
                                                                            handleEditSubtask(task.id, subtask.id, editingSubtaskTitle)
                                                                        } else {
                                                                            setEditingSubtask(null)
                                                                            setEditingSubtaskTitle("")
                                                                        }
                                                                    }}
                                                                    className="h-7 text-xs flex-1 min-w-[200px]"
                                                                    autoFocus
                                                                />
                                                            ) : (
                                                                <span className={`text-xs text-muted-foreground ${subtask.isDone ? 'line-through opacity-70' : ''}`}>
                                                                    {subtask.title}
                                                                </span>
                                                            )}

                                                            <div className="opacity-0 group-hover/subtask:opacity-100 flex items-center gap-1 ml-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setEditingSubtask({ taskId: task.id, subtaskId: subtask.id })
                                                                        setEditingSubtaskTitle(subtask.title)
                                                                    }}
                                                                >
                                                                    <Pencil className="h-3 w-3" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleDeleteSubtask(task.id, subtask.id)
                                                                    }}
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Empty Cell for Assigned To in Subtask Row */}
                                                    <td className="p-2 border-r border-border/50"></td>
                                                    {/* Empty for Status */}
                                                    <td className="border-b border-border/20"></td>
                                                    {/* Empty for Priority */}
                                                    <td className="border-b border-border/20"></td>
                                                    {/* Empty for Deadline */}
                                                    <td className="border-b border-border/20"></td>
                                                    {/* Empty for Actions */}
                                                    <td className="border-b border-border/20"></td>
                                                </tr>
                                            ))
                                        )}
                                    </>
                                ))
                            )}
                        </tbody>
                    </table>
                </div >
            </CardContent >

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
                currentUserId={currentUserId}
            />

            {/* Filters Dialog */}
            <Dialog open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{t('tasks.filters')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        {/* Status Filter */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">Status</label>
                            <div className="space-y-2">
                                {[
                                    { value: 'TODO', label: 'Open' },
                                    { value: 'IN_PROGRESS', label: 'In Progress' },
                                    { value: 'DONE', label: 'Completed' },
                                    { value: 'OVERDUE', label: 'Overdue' }
                                ].map(status => (
                                    <div key={status.value} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`status-${status.value}`}
                                            checked={filters.status.includes(status.value)}
                                            onCheckedChange={(checked) => {
                                                setFilters(prev => ({
                                                    ...prev,
                                                    status: checked
                                                        ? [...prev.status, status.value]
                                                        : prev.status.filter(s => s !== status.value)
                                                }))
                                            }}
                                        />
                                        <label
                                            htmlFor={`status-${status.value}`}
                                            className="text-sm cursor-pointer"
                                        >
                                            {status.label}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Deadline Filter */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">Deadline</label>
                            <div className="space-y-2">
                                {[
                                    { value: 'today', label: 'Today' },
                                    { value: 'thisWeek', label: 'This week' },
                                    { value: 'overdue', label: 'Overdue' }
                                ].map(option => (
                                    <div key={option.value} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`deadline-${option.value}`}
                                            checked={filters.deadline.includes(option.value)}
                                            onCheckedChange={(checked) => {
                                                setFilters(prev => ({
                                                    ...prev,
                                                    deadline: checked
                                                        ? [...prev.deadline, option.value]
                                                        : prev.deadline.filter(d => d !== option.value)
                                                }))
                                            }}
                                        />
                                        <label
                                            htmlFor={`deadline-${option.value}`}
                                            className="text-sm cursor-pointer"
                                        >
                                            {option.label}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Priority Filter */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">Priority</label>
                            <div className="space-y-2">
                                {[
                                    { value: 'high', label: 'High' },
                                    { value: 'medium', label: 'Medium' },
                                    { value: 'low', label: 'Low' }
                                ].map(priority => (
                                    <div key={priority.value} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`priority-${priority.value}`}
                                            checked={filters.priority.includes(priority.value)}
                                            onCheckedChange={(checked) => {
                                                setFilters(prev => ({
                                                    ...prev,
                                                    priority: checked
                                                        ? [...prev.priority, priority.value]
                                                        : prev.priority.filter(p => p !== priority.value)
                                                }))
                                            }}
                                        />
                                        <label
                                            htmlFor={`priority-${priority.value}`}
                                            className="text-sm cursor-pointer"
                                        >
                                            {priority.label}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Users Filter */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">Assigned To</label>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {users.map(user => (
                                    <div key={user.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`user-filter-${user.id}`}
                                            checked={filters.users.includes(user.id)}
                                            onCheckedChange={(checked) => {
                                                setFilters(prev => ({
                                                    ...prev,
                                                    users: checked
                                                        ? [...prev.users, user.id]
                                                        : prev.users.filter(u => u !== user.id)
                                                }))
                                            }}
                                        />
                                        <label
                                            htmlFor={`user-filter-${user.id}`}
                                            className="text-sm cursor-pointer"
                                        >
                                            {user.name || user.email}
                                            {currentUserId && user.id === currentUserId && (
                                                <span className="text-muted-foreground ml-1">(you)</span>
                                            )}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Personal Scope Filters */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">Personal Scope</label>
                            <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="assignedToMe"
                                        checked={filters.assignedToMe}
                                        onCheckedChange={(checked) => {
                                            setFilters(prev => ({ ...prev, assignedToMe: checked as boolean }))
                                        }}
                                    />
                                    <label
                                        htmlFor="assignedToMe"
                                        className="text-sm cursor-pointer"
                                    >
                                        Tasks assigned to me
                                    </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="createdByMe"
                                        checked={filters.createdByMe}
                                        onCheckedChange={(checked) => {
                                            setFilters(prev => ({ ...prev, createdByMe: checked as boolean }))
                                        }}
                                    />
                                    <label
                                        htmlFor="createdByMe"
                                        className="text-sm cursor-pointer"
                                    >
                                        Tasks I created
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button
                            variant="outline"
                            onClick={clearAllFilters}
                            disabled={activeFiltersCount === 0}
                        >
                            {t('common.clearAll')}
                        </Button>
                        <Button onClick={() => setIsFiltersOpen(false)}>
                            {t('common.close')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </Card >
    )
}
