"use client"


import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { Trash2, Calendar, Plus, MoreVertical, Pencil, Play, Square, CheckCircle2, AlertCircle, Edit } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { format, isPast, isToday, endOfWeek, isWithinInterval } from "date-fns"
import { he } from "date-fns/locale"
import { TaskDetailDialog } from "./TaskDetailDialog"
import { CreateTaskDialog } from "./CreateTaskDialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Filter, X, ArrowUpDown, LayoutGrid, List as ListIcon } from "lucide-react"
import { useLanguage } from "@/lib/useLanguage"
import confetti from "canvas-confetti"
import { TasksBoard } from "./board/TasksBoard"

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
        startDate?: Date | string | null;
        deadline: Date | string | null;
        description: string | null;
        assignees: Array<{ id: string; name: string | null }>;
        watchers?: Array<{ id: string; name: string | null; image?: string | null }>;
        labels?: Array<{ id: string; name: string; color: string }>;
        blocking?: Array<{ id: string; title: string; status: string }>;
        blockedBy?: Array<{ id: string; title: string; status: string }>;
        checklist: Array<{ id: string; text: string; isDone: boolean }>;
        subtasks?: Array<{ id: string; title: string; isDone: boolean }>;
        createdAt?: Date | string;
    }>
    users: User[]
    isAdmin: boolean
    currentUserId?: string
    tasksWithActiveTimers?: Record<string, Array<{ id: string; name: string | null }>> // Map of task IDs to users actively working on them
    labels?: Array<{ id: string; name: string; color: string }>
}

export function TasksView({ initialTasks, users, isAdmin, currentUserId, tasksWithActiveTimers = {}, labels = [] }: TasksViewProps) {
    const router = useRouter()
    const { t, isRTL, language } = useLanguage()
    const dateLocale = language === 'he' ? he : undefined
    const [tasks, setTasks] = useState(initialTasks)
    const [newSubtaskTitle, setNewSubtaskTitle] = useState<Record<string, string>>({})
    const [editingSubtask, setEditingSubtask] = useState<{ taskId: string; subtaskId: string } | null>(null)
    const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("")

    const [localSubtasks, setLocalSubtasks] = useState<Record<string, Array<{ id: string; title: string; isDone: boolean }>>>({})
    const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({})
    const [visibleSubtasksMap, setVisibleSubtasksMap] = useState<Record<string, boolean>>({})
    const [stoppedTimers, setStoppedTimers] = useState<Set<string>>(new Set()) // Track tasks where timer was stopped
    const pendingOperations = useRef<Set<string>>(new Set()) // Track pending operations by subtask ID
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [selectedTask, setSelectedTask] = useState<TasksViewProps['initialTasks'][0] | null>(null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const searchParams = useSearchParams()
    const [deepLinkNoteId, setDeepLinkNoteId] = useState<string | null>(null)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    const [viewMode, setViewMode] = useState<'list' | 'board'>('list')

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

    useEffect(() => {
        const taskId = searchParams.get('taskId')
        const noteId = searchParams.get('noteId')

        if (taskId && tasks.length > 0) {
            const task = tasks.find(t => t.id === taskId)
            if (task && (!selectedTask || selectedTask.id !== taskId)) {
                setSelectedTask(task)
                setIsDetailOpen(true)
                setDeepLinkNoteId(noteId)

                // Fetch time entries for this task
                fetch(`/api/tasks/${taskId}/time-entries`).then(res => {
                    if (res.ok) return res.json()
                }).then(data => {
                    if (data) setTaskTimeEntries(data)
                })
            }
        }
    }, [searchParams, tasks, selectedTask])



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

        // Deadline filter - now considers both startDate and deadline
        if (filters.deadline.length > 0) {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const weekEnd = endOfWeek(today, { weekStartsOn: 0 })

            // Check if task is active today (between startDate and deadline, or just deadline if no startDate)
            const taskStartDate = task.startDate ? new Date(task.startDate) : null
            const taskDeadline = task.deadline ? new Date(task.deadline) : null

            // Task is active today if:
            // 1. Has startDate and deadline: today is between startDate and deadline
            // 2. Has only deadline: today is deadline
            // 3. Has only startDate: today is >= startDate
            const isActiveToday =
                (taskStartDate && taskDeadline && today >= taskStartDate && today <= taskDeadline) ||
                (!taskStartDate && taskDeadline && isToday(taskDeadline)) ||
                (taskStartDate && !taskDeadline && today >= taskStartDate)

            let matchesDeadline = false
            if (filters.deadline.includes('today')) {
                if (isActiveToday) {
                    matchesDeadline = true
                } else if (taskDeadline && isToday(taskDeadline)) {
                    matchesDeadline = true
                }
            }
            if (filters.deadline.includes('overdue') && taskDeadline && isPast(taskDeadline) && !isToday(taskDeadline)) {
                matchesDeadline = true
            }
            if (filters.deadline.includes('thisWeek')) {
                if (taskDeadline && isWithinInterval(taskDeadline, { start: today, end: weekEnd })) {
                    matchesDeadline = true
                } else if (taskStartDate && isWithinInterval(taskStartDate, { start: today, end: weekEnd })) {
                    matchesDeadline = true
                }
            }
            if (!matchesDeadline) {
                return false
            }
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

    const handleStatusChange = async (taskId: string, newStatus: string) => {
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))

        if (newStatus === 'DONE') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            })
        }

        try {
            const res = await fetch("/api/tasks", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: taskId, status: newStatus }),
            })

            if (!res.ok) throw new Error("Failed to update status")
            router.refresh()
        } catch (error) {
            console.error("Failed to update task status:", error)
        }
    }

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
                'TODO': t('tasks.statusTodo'),
                'IN_PROGRESS': t('tasks.statusInProgress'),
                'DONE': t('tasks.statusDone'),
                'OVERDUE': t('tasks.statusOverdue'),
                'BLOCKED': t('tasks.statusBlocked')
            }
            return labels[value] || value
        }
        if (type === 'deadline') {
            const labels: Record<string, string> = {
                'today': t('timeEntries.today'),
                'thisWeek': 'This week',
                'overdue': t('tasks.statusOverdue')
            }
            return labels[value] || value
        }
        if (type === 'priority') {
            const labels: Record<string, string> = {
                'high': t('tasks.priorityHigh'),
                'medium': t('tasks.priorityMedium'),
                'low': t('tasks.priorityLow')
            }
            return labels[value] || value
        }
        if (type === 'users') {
            const user = users.find(u => u.id === value)
            return user?.name || user?.email || value
        }
        return value
    }

    const handleToggleTaskCompletion = async (taskId: string, checked: boolean) => {
        const newStatus = checked ? 'DONE' : 'TODO'
        const previousTasks = tasks
        const previousSubtasks = localSubtasks

        // Optimistic update - update task status
        setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t))

        if (checked) {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            })
        }

        // If marking as DONE, also mark all subtasks as done optimistically
        if (checked && localSubtasks[taskId]) {
            setLocalSubtasks(prev => ({
                ...prev,
                [taskId]: (prev[taskId] || []).map(st => ({ ...st, isDone: true }))
            }))
        }

        // If marking as DONE and has active timer, mark timer as stopped locally
        if (checked && tasksWithActiveTimers[taskId]?.length > 0) {
            setStoppedTimers(prev => new Set(Array.from(prev).concat(taskId)))
        }

        try {
            // 1. Update task status
            const taskResponse = await fetch("/api/tasks", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: taskId, status: newStatus }),
            })

            if (!taskResponse.ok) {
                throw new Error("Failed to update task")
            }

            // If marking as DONE, do additional actions
            if (checked) {
                // 2. Stop active timer if running
                if (tasksWithActiveTimers[taskId]?.length > 0) {
                    try {
                        await fetch('/api/time-entries', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                action: 'stop'
                            })
                        })
                    } catch (timerError) {
                        console.error("Failed to stop timer:", timerError)
                        // Don't fail the whole operation if timer stop fails
                    }
                }

                // 3. Mark all subtasks as done
                const subtasks = localSubtasks[taskId] || []
                if (subtasks.length > 0) {
                    try {
                        await Promise.all(
                            subtasks.map(subtask =>
                                fetch("/api/tasks/subtasks", {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        id: subtask.id,
                                        isDone: true
                                    })
                                })
                            )
                        )
                    } catch (subtaskError) {
                        console.error("Failed to update some subtasks:", subtaskError)
                        // Don't fail the whole operation
                    }
                }
            }

            router.refresh()
        } catch (error) {
            // Revert all optimistic updates on error
            setTasks(previousTasks)
            setLocalSubtasks(previousSubtasks)
            console.error("Failed to update task:", error)
            alert("Failed to update task status")
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



    const handleAddSubtask = async (taskId: string) => {
        const trimmedTitle = (newSubtaskTitle[taskId] || "").trim()
        if (!trimmedTitle) return

        const tempId = `temp-${Date.now()}-${Math.random()}`
        const titleToSave = trimmedTitle

        // Clear input IMMEDIATELY - keep input field open for rapid entry
        setNewSubtaskTitle(prev => ({ ...prev, [taskId]: "" }))

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



    const handleUpdateSubtask = async (taskId: string, subtaskId: string) => {
        const trimmedTitle = editingSubtaskTitle.trim()
        if (!trimmedTitle) {
            setEditingSubtask(null)
            return
        }

        // Store previous state for revert
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
        // Find task/subtask title for description
        const task = tasks.find(t => t.id === taskId)
        let description = task?.title || ''

        if (subtaskId) {
            const subtask = (localSubtasks[taskId] || task?.subtasks || []).find(s => s.id === subtaskId)
            if (subtask) {
                description = subtask.title
            }
        }

        // Navigate to dashboard immediately for instant feedback
        router.push('/dashboard')

        // Start timer in background (fire and forget)
        try {
            const response = await fetch('/api/time-entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start',
                    taskIds: [taskId],
                    subtaskId: subtaskId || null,
                    description: description
                })
            })

            if (!response.ok) {
                const data = await response.json()
                console.error('Failed to start timer:', data.message || 'Unknown error')
                // Don't show alert since user is already on dashboard
                // The dashboard will show the timer state correctly
            } else {
                // Refresh to show the task name on dashboard
                router.refresh()
            }
        } catch (error) {
            console.error('Failed to start working:', error)
            // Error is logged but not shown to user since they're already on dashboard
        }
    }

    const handleStopWorking = async (taskId: string) => {
        // Optimistically update stopped timers
        setStoppedTimers(prev => new Set(Array.from(prev).concat(taskId)))

        try {
            const response = await fetch('/api/time-entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'stop'
                })
            })

            if (response.ok) {
                router.refresh()
            } else {
                // Revert optimistic update on failure
                setStoppedTimers(prev => {
                    const next = new Set(prev)
                    next.delete(taskId)
                    return next
                })
            }
        } catch (error) {
            console.error('Failed to stop working:', error)
            setStoppedTimers(prev => {
                const next = new Set(prev)
                next.delete(taskId)
                return next
            })
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



    const handleTaskUpdate = (updatedFields?: Partial<TasksViewProps['initialTasks'][number]>) => {
        if (!updatedFields) {
            router.refresh()
            return
        }

        // Optimistic update
        if (selectedTask) {
            setSelectedTask(prev => prev ? { ...prev, ...updatedFields } : null)
        }
        setTasks(prev => prev.map(t => t.id === selectedTask?.id ? { ...t, ...updatedFields } : t))

        // Refresh server data in background
        router.refresh()
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

                    {/* View Toggle */}
                    <div className="flex bg-muted/50 p-1 rounded-md h-9">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewMode('list')}
                            className={`h-full px-2.5 rounded-sm hover:bg-background ${viewMode === 'list' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                        >
                            <ListIcon className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewMode('board')}
                            className={`h-full px-2.5 rounded-sm hover:bg-background ${viewMode === 'board' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                    </div>

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
                            <SelectItem value="deadline-near">{t('tasks.sortByDeadlineNear')}</SelectItem>
                            <SelectItem value="deadline-far">{t('tasks.sortByDeadlineFar')}</SelectItem>
                            <SelectItem value="priority-high">{t('tasks.sortByPriorityHigh')}</SelectItem>
                            <SelectItem value="priority-low">{t('tasks.sortByPriorityLow')}</SelectItem>
                            <SelectItem value="created-new">{t('tasks.sortByCreatedNew')}</SelectItem>
                            <SelectItem value="created-old">{t('tasks.sortByCreatedOld')}</SelectItem>
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
                                {t('tasks.assignedToMe')}
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
                                {t('tasks.tasksICreated')}
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
                {viewMode === 'board' ? (
                    <div className="h-[calc(100vh-250px)] px-4 pb-4">
                        <TasksBoard
                            tasks={filteredTasks}
                            onTaskClick={(task) => {
                                setSelectedTask(task)
                                setIsDetailOpen(true)
                            }}
                            onStatusChange={handleStatusChange}
                        />
                    </div>
                ) : (
                    <div className="rounded-md border border-border overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 sticky top-0 z-10 border-b border-border">
                                <tr className="border-b border-border/50">
                                    <th className="h-10 px-4 text-left font-normal text-muted-foreground bg-muted/20 first:rounded-tl-lg">
                                        {t('tasks.title') || 'Task'}
                                    </th>
                                    <th className="h-10 px-4 text-left font-normal text-muted-foreground w-[150px] bg-muted/20">
                                        {t('tasks.assignToLabel') || 'Assigned to'}
                                    </th>
                                    {/* Priority */}
                                    <th className="h-10 px-4 text-center font-normal text-muted-foreground w-[140px] bg-muted/20">
                                        {t('tasks.priority') || 'Priority'}
                                    </th>
                                    {/* Date */}
                                    <th className="h-10 px-4 text-center font-normal text-muted-foreground w-[150px] bg-muted/20">
                                        {t('tasks.date') || 'Date'}
                                    </th>
                                    {/* Status */}
                                    <th className="h-10 px-4 text-center font-normal text-muted-foreground w-[140px] bg-muted/20 last:rounded-tr-lg">
                                        {t('tasks.status')}
                                    </th>
                                </tr>
                            </thead>
                            {
                                filteredTasks.length === 0 ? (
                                    <tbody>
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-muted-foreground italic">
                                                {t('tasks.noTasksFound')}
                                            </td>
                                        </tr>
                                    </tbody>
                                ) : (
                                    filteredTasks.map((task) => (
                                        <tbody key={task.id} className="border-b border-border last:border-0 relative hover:bg-muted/5 transition-colors">
                                            <tr className="group transition-colors">
                                                {/* Task Title & Subtask Toggle */}
                                                <td className="p-2 border-r border-border/50 min-w-[300px]">
                                                    <div className="flex items-center gap-3">
                                                        <Checkbox
                                                            checked={task.status === 'DONE'}
                                                            onCheckedChange={(checked) => handleToggleTaskCompletion(task.id, checked as boolean)}
                                                            className="rounded-md h-5 w-5 border-2 border-primary"
                                                        />

                                                        <div className="flex flex-col min-w-0 flex-1">
                                                            <span
                                                                className={`font-medium truncate cursor-pointer hover:underline hover:text-primary ${task.status === 'DONE' ? 'line-through text-muted-foreground' : ''}`}
                                                                onClick={async () => {
                                                                    setSelectedTask(task)
                                                                    setIsDetailOpen(true)
                                                                    // Fetch time entries for this task
                                                                    try {
                                                                        const response = await fetch(`/api/tasks/${task.id}/time-entries`)
                                                                        if (response.ok) {
                                                                            const data = await response.json()
                                                                            setTaskTimeEntries(data || [])
                                                                        } else {
                                                                            setTaskTimeEntries([])
                                                                        }
                                                                    } catch (error) {
                                                                        console.error('Failed to fetch time entries:', error)
                                                                        setTaskTimeEntries([])
                                                                    }
                                                                }}
                                                            >
                                                                {task.title}
                                                            </span>

                                                            {/* Subtask Meta & Master Toggle */}
                                                            <div className="flex items-center gap-2 mt-1">
                                                                {localSubtasks[task.id] && localSubtasks[task.id].length > 0 ? (
                                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                setVisibleSubtasksMap(prev => ({ ...prev, [task.id]: !prev[task.id] }))
                                                                            }}
                                                                            className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer focus:outline-none bg-muted/30 px-1.5 py-0.5 rounded-sm hover:bg-muted/50"
                                                                        >
                                                                            <div className={`w-1.5 h-1.5 rounded-full ${visibleSubtasksMap[task.id] ? 'bg-primary' : 'bg-muted-foreground/40'}`}></div>
                                                                            <span className="font-medium">
                                                                                {visibleSubtasksMap[task.id]
                                                                                    ? t('tasks.hideSubtasks').replace('{count}', localSubtasks[task.id].length.toString())
                                                                                    : t('tasks.showSubtasks').replace('{count}', localSubtasks[task.id].length.toString())}
                                                                            </span>
                                                                        </button>
                                                                        <span>•</span>
                                                                        <span>{t('tasks.subtasksDone').replace('{done}', localSubtasks[task.id].filter(st => st.isDone).length.toString()).replace('{total}', localSubtasks[task.id].length.toString())}</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1">
                                                                        <Plus className="h-3 w-3 text-muted-foreground/60" />
                                                                        <Input
                                                                            placeholder={t('tasks.addSubtaskPlaceholder')}
                                                                            value={newSubtaskTitle[task.id] || ""}
                                                                            onChange={(e) => setNewSubtaskTitle(prev => ({ ...prev, [task.id]: e.target.value }))}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter' && (newSubtaskTitle[task.id] || "").trim()) {
                                                                                    handleAddSubtask(task.id)
                                                                                }
                                                                            }}
                                                                            className="h-6 text-xs border-none bg-transparent hover:bg-muted/30 focus-visible:ring-0 focus-visible:ring-offset-0 px-1"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Actions Menu - Same as subtasks */}
                                                        {(isAdmin || (currentUserId && task.assignees.some(a => a.id === currentUserId))) && (
                                                            <div className="ml-auto opacity-0 group-hover:opacity-100">
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <button className="text-muted-foreground hover:text-primary p-1">
                                                                            <MoreVertical className="h-4 w-4" />
                                                                        </button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        {tasksWithActiveTimers[task.id]?.some(u => u.id === currentUserId) && !stoppedTimers.has(task.id) ? (
                                                                            <DropdownMenuItem onClick={() => handleStopWorking(task.id)}>
                                                                                <Square className="h-4 w-4 mr-2" />
                                                                                {t('tasks.stopWorking')}
                                                                            </DropdownMenuItem>
                                                                        ) : (
                                                                            <DropdownMenuItem onClick={() => handleStartWorking(task.id)}>
                                                                                <Play className="h-4 w-4 mr-2" />
                                                                                {t('tasks.startWorking')}
                                                                            </DropdownMenuItem>
                                                                        )}
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
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Assigned To */}
                                                <td className="p-2 border-r border-border/50 w-[80px]">
                                                    <div className="flex -space-x-2 overflow-hidden justify-center pl-2">
                                                        {task.assignees.length > 0 ? (
                                                            task.assignees.map((assignee) => (
                                                                <Avatar key={assignee.id} className="inline-block h-8 w-8 rounded-full ring-2 ring-background border bg-muted">
                                                                    <AvatarFallback className="text-[10px] font-medium bg-primary/10 text-primary">
                                                                        {assignee.name ? assignee.name.substring(0, 2).toUpperCase() : "??"}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                            ))
                                                        ) : (
                                                            <div className="h-8 w-8 rounded-full bg-muted border border-dashed flex items-center justify-center">
                                                                <span className="text-[10px] text-muted-foreground">-</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Priority */}
                                                <td className="p-1 align-middle text-center border-r border-border/50">
                                                    <div className={`
                                                h-8 w-full max-w-[140px] mx-auto flex items-center justify-center gap-1.5 text-xs font-semibold shadow-sm p-2 rounded-md border
                                                ${getPriorityColor(task.priority)}
                                            `}>
                                                        <span>{task.priority === 'HIGH' ? t('tasks.priorityHigh') : task.priority === 'MEDIUM' ? t('tasks.priorityMedium') : t('tasks.priorityLow')}</span>
                                                    </div>
                                                </td>

                                                {/* Date */}
                                                <td className="p-2 align-middle text-center border-r border-border/50">
                                                    {(task.startDate || task.deadline) ? (
                                                        <div className="flex flex-col items-center justify-center gap-0.5 text-xs">
                                                            {task.startDate && task.deadline ? (
                                                                <>
                                                                    <div className="text-muted-foreground">
                                                                        {format(new Date(task.startDate), 'MMM d', { locale: dateLocale })}
                                                                    </div>
                                                                    <span className="text-muted-foreground/50">-</span>
                                                                    <div className={`
                                                                flex items-center gap-1
                                                                ${isPast(new Date(task.deadline)) && !isToday(new Date(task.deadline)) && task.status !== 'DONE'
                                                                            ? 'text-destructive font-medium'
                                                                            : 'text-muted-foreground'
                                                                        }`}>
                                                                        <Calendar className="h-3 w-3" />
                                                                        {format(new Date(task.deadline), 'MMM d', { locale: dateLocale })}
                                                                    </div>
                                                                </>
                                                            ) : task.deadline ? (
                                                                <div className={`
                                                            flex items-center gap-1
                                                            ${isPast(new Date(task.deadline)) && !isToday(new Date(task.deadline)) && task.status !== 'DONE'
                                                                        ? 'text-destructive font-medium'
                                                                        : 'text-muted-foreground'
                                                                    }`}>
                                                                    <Calendar className="h-3 w-3" />
                                                                    {format(new Date(task.deadline), 'MMM d', { locale: dateLocale })}
                                                                </div>
                                                            ) : task.startDate ? (
                                                                <div className="text-muted-foreground">
                                                                    {format(new Date(task.startDate), 'MMM d', { locale: dateLocale })}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground/30 text-xs">-</span>
                                                    )}
                                                </td>

                                                {/* Status */}
                                                <td className="p-1 align-middle text-center">
                                                    <div
                                                        className={`
                                                    h-8 w-full max-w-[140px] mx-auto flex items-center justify-center gap-2 text-xs font-semibold text-white shadow-sm rounded-md transition-all
                                                    ${task.status === 'DONE' ? 'bg-[#00c875] hover:bg-[#00c875]/90' : ''}
                                                    ${task.status === 'IN_PROGRESS' || (tasksWithActiveTimers[task.id] && tasksWithActiveTimers[task.id].length > 0) ? 'bg-[#0073ea] hover:bg-[#0060b9]' : ''}
                                                    ${task.status === 'BLOCKED' ? 'bg-[#e2445c] hover:bg-[#c93b51]' : ''}
                                                    ${task.status === 'TODO' && !((tasksWithActiveTimers[task.id] && tasksWithActiveTimers[task.id].length > 0)) ? 'bg-[#c4c4c4] hover:bg-[#b0b0b0]' : ''}
                                                    ${isPast(new Date(task.deadline || '')) && !isToday(new Date(task.deadline || '')) && task.status !== 'DONE' ? 'bg-[#e2445c] hover:bg-[#d00000]' : ''}
                                                `}
                                                    >
                                                        {task.status === 'DONE' && <CheckCircle2 className="h-3.5 w-3.5" />}
                                                        {isPast(new Date(task.deadline || '')) && !isToday(new Date(task.deadline || '')) && task.status !== 'DONE' && <AlertCircle className="h-3.5 w-3.5" />}

                                                        <span className="truncate">
                                                            {task.status === 'DONE' ? t('tasks.statusDone') :
                                                                isPast(new Date(task.deadline || '')) && !isToday(new Date(task.deadline || '')) && task.status !== 'DONE' ? t('tasks.statusOverdue') :
                                                                    task.status === 'BLOCKED' ? (t('tasks.statusBlocked') || 'Blocked') :
                                                                        (tasksWithActiveTimers[task.id] && tasksWithActiveTimers[task.id].length > 0 && !stoppedTimers.has(task.id))
                                                                            ? (tasksWithActiveTimers[task.id].length > 1
                                                                                ? t('tasks.usersWorking').replace('{count}', tasksWithActiveTimers[task.id].length.toString())
                                                                                : t('tasks.userIsWorking').replace('{name}', tasksWithActiveTimers[task.id][0].name?.split(' ')[0] || 'User'))
                                                                            : (task.status === 'IN_PROGRESS' ? (t('tasks.statusInProgress') || 'In Progress') : t('tasks.statusTodo'))
                                                            }
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Nested Subtasks Rendered as Rows */}
                                            {localSubtasks[task.id] && localSubtasks[task.id].length > 0 && visibleSubtasksMap[task.id] && (() => {
                                                const subtasks = localSubtasks[task.id]
                                                const isExpanded = expandedSubtasks[task.id]
                                                const displaySubtasks = isExpanded ? subtasks : subtasks.slice(0, 5)
                                                const hasMore = subtasks.length > 5

                                                return (
                                                    <>
                                                        {displaySubtasks.map((subtask, index) => {
                                                            const isLast = index === displaySubtasks.length - 1 && !hasMore
                                                            return (
                                                                <tr key={subtask.id} className="group/subtask bg-muted/5 hover:bg-muted/10 relative">
                                                                    {/* Spacing for Task Title (nested) */}
                                                                    <td className="p-2 pl-12 border-r border-border/50 relative">
                                                                        {/* Continuous Hierarchy Line */}
                                                                        <div className="absolute left-[36px] top-0 bottom-0 w-[1px] bg-border/50 group-last/subtask:bottom-1/2"></div>
                                                                        {/* Branch Line */}
                                                                        <div className="absolute left-[36px] top-1/2 w-4 h-[1px] bg-border/50"></div>
                                                                        {/* Mask bottom part of line for last item if no "Show More" */}
                                                                        {isLast && !hasMore && (
                                                                            <div className="absolute left-[36px] top-1/2 bottom-0 w-[2px] bg-background translate-x-[-0.5px]"></div>
                                                                        )}

                                                                        <div className="flex items-center gap-2 relative">
                                                                            <Checkbox
                                                                                checked={subtask.isDone}
                                                                                className="rounded-full w-4 h-4 border-2"
                                                                                onCheckedChange={() => handleToggleSubtask(task.id, subtask.id, subtask.isDone)}
                                                                            />

                                                                            {editingSubtask?.subtaskId === subtask.id ? (
                                                                                <Input
                                                                                    value={editingSubtaskTitle}
                                                                                    onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter') handleUpdateSubtask(task.id, subtask.id)
                                                                                        if (e.key === 'Escape') setEditingSubtask(null)
                                                                                    }}
                                                                                    onBlur={() => handleUpdateSubtask(task.id, subtask.id)}
                                                                                    autoFocus
                                                                                    className="h-7 text-sm"
                                                                                />
                                                                            ) : (
                                                                                <span
                                                                                    className={`text-sm truncate cursor-pointer hover:underline ${subtask.isDone ? 'line-through text-muted-foreground' : ''}`}
                                                                                    onClick={() => {
                                                                                        setEditingSubtask({ taskId: task.id, subtaskId: subtask.id })
                                                                                        setEditingSubtaskTitle(subtask.title)
                                                                                    }}
                                                                                >
                                                                                    {subtask.title}
                                                                                </span>
                                                                            )}

                                                                            {tasksWithActiveTimers[subtask.id] && tasksWithActiveTimers[subtask.id].length > 0 && (
                                                                                <Badge variant="secondary" className="bg-[#fdab3d]/10 text-[#fdab3d] hover:bg-[#fdab3d]/20 border-none text-[10px] h-5 px-1.5 flex items-center gap-1">
                                                                                    {tasksWithActiveTimers[subtask.id].length > 1
                                                                                        ? t('tasks.usersWorking').replace('{count}', tasksWithActiveTimers[subtask.id].length.toString())
                                                                                        : t('tasks.userIsWorking').replace('{name}', tasksWithActiveTimers[subtask.id][0].name?.split(' ')[0] || 'User')}
                                                                                </Badge>
                                                                            )}

                                                                            <div className="ml-auto opacity-0 group-hover/subtask:opacity-100">
                                                                                <DropdownMenu>
                                                                                    <DropdownMenuTrigger asChild>
                                                                                        <button className="text-muted-foreground hover:text-primary p-1">
                                                                                            <MoreVertical className="h-3 w-3" />
                                                                                        </button>
                                                                                    </DropdownMenuTrigger>
                                                                                    <DropdownMenuContent align="end" className="w-48">
                                                                                        {tasksWithActiveTimers[subtask.id]?.some(u => u.id === currentUserId) && !stoppedTimers.has(subtask.id) ? (
                                                                                            <DropdownMenuItem
                                                                                                onClick={() => handleStopWorking(subtask.id)}
                                                                                                className="cursor-pointer"
                                                                                            >
                                                                                                <Square className="mr-2 h-4 w-4" />
                                                                                                {t('tasks.stopWorking')}
                                                                                            </DropdownMenuItem>
                                                                                        ) : (
                                                                                            <DropdownMenuItem
                                                                                                onClick={() => handleStartWorking(task.id, subtask.id)}
                                                                                                className="cursor-pointer"
                                                                                            >
                                                                                                <Play className="mr-2 h-4 w-4" />
                                                                                                {t('tasks.startWorking')}
                                                                                            </DropdownMenuItem>
                                                                                        )}
                                                                                        <DropdownMenuItem
                                                                                            onClick={() => {
                                                                                                setEditingSubtask({ taskId: task.id, subtaskId: subtask.id })
                                                                                                setEditingSubtaskTitle(subtask.title)
                                                                                            }}
                                                                                            className="cursor-pointer"
                                                                                        >
                                                                                            <Edit className="mr-2 h-4 w-4" />
                                                                                            {t('tasks.editSubtask')}
                                                                                        </DropdownMenuItem>
                                                                                        <DropdownMenuSeparator />
                                                                                        <DropdownMenuItem
                                                                                            onClick={() => handleDeleteSubtask(task.id, subtask.id)}
                                                                                            className="cursor-pointer text-destructive focus:text-destructive"
                                                                                        >
                                                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                                                            {t('tasks.deleteSubtask')}
                                                                                        </DropdownMenuItem>
                                                                                    </DropdownMenuContent>
                                                                                </DropdownMenu>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-2 border-r border-border/50"></td>
                                                                    <td className="p-2 border-r border-border/50"></td>
                                                                    <td className="p-2 border-r border-border/50"></td>
                                                                    <td className="p-2 border-r border-border/50"></td>
                                                                    <td className="p-2"></td>
                                                                </tr>
                                                            )
                                                        })}
                                                        {hasMore && !isExpanded && (
                                                            <tr className="bg-muted/5 hover:bg-muted/10 cursor-pointer" onClick={() => setExpandedSubtasks(prev => ({ ...prev, [task.id]: true }))}>
                                                                <td className="p-2 pl-12 border-r border-border/50 relative">
                                                                    {/* Hierarchy Line Continuing to this "Show More" item */}
                                                                    <div className="absolute left-[36px] top-0 bottom-1/2 w-[1px] bg-border/50"></div>
                                                                    <div className="absolute left-[36px] top-1/2 w-4 h-[1px] bg-border/50"></div>

                                                                    <div className="flex items-center gap-2 pl-6">
                                                                        <span className="text-xs text-muted-foreground hover:text-primary font-medium">
                                                                            {t('tasks.showMoreSubtasks').replace('{count}', (subtasks.length - 5).toString())}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td colSpan={5}></td>
                                                            </tr>
                                                        )}

                                                        {/* Add New Subtask Row */}
                                                        <tr className="group/add-subtask bg-muted/5 hover:bg-muted/10 relative">
                                                            <td className="p-2 pl-12 border-r border-border/50 relative">
                                                                {/* Hierarchy Line */}
                                                                <div className="absolute left-[36px] top-0 bottom-1/2 w-[1px] bg-border/50"></div>
                                                                <div className="absolute left-[36px] top-1/2 w-4 h-[1px] bg-border/50"></div>

                                                                <div className="flex items-center gap-2 pl-6">
                                                                    <Plus className="h-3 w-3 text-muted-foreground/60" />
                                                                    <Input
                                                                        placeholder={t('tasks.addSubtaskPlaceholder')}
                                                                        value={newSubtaskTitle[task.id] || ""}
                                                                        onChange={(e) => setNewSubtaskTitle(prev => ({ ...prev, [task.id]: e.target.value }))}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter' && (newSubtaskTitle[task.id] || "").trim()) {
                                                                                handleAddSubtask(task.id)
                                                                                // Auto-expand subtasks after adding
                                                                                setVisibleSubtasksMap(prev => ({ ...prev, [task.id]: true }))
                                                                            }
                                                                        }}
                                                                        className="h-6 text-xs border-none bg-transparent hover:bg-muted/30 focus-visible:ring-0 focus-visible:ring-offset-0 px-1"
                                                                    />
                                                                </div>
                                                            </td>
                                                            <td className="p-2 border-r border-border/50"></td>
                                                            <td className="p-2 border-r border-border/50"></td>
                                                            <td className="p-2 border-r border-border/50"></td>
                                                            <td className="p-2 border-r border-border/50"></td>
                                                            <td className="p-2"></td>
                                                        </tr>
                                                    </>
                                                )
                                            })()}
                                        </tbody>
                                    ))
                                )
                            }
                        </table>
                    </div>
                )}
            </CardContent>

            <TaskDetailDialog
                task={selectedTask}
                open={isDetailOpen}
                onOpenChange={(open) => {
                    setIsDetailOpen(open)
                    if (!open) {
                        setDeepLinkNoteId(null)
                        // Clear search params to avoid re-opening on refresh
                        const newUrl = window.location.pathname
                        window.history.replaceState({}, '', newUrl)
                    }
                }}
                timeEntries={taskTimeEntries}
                onUpdate={handleTaskUpdate}
                projectUsers={users}
                highlightNoteId={deepLinkNoteId}
                labels={labels}
                allTasks={tasks.map(t => ({ id: t.id, title: t.title, status: t.status }))}
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
                onOptimisticTaskCreate={(updatedTask) => {
                    setTasks(prev => {
                        const exists = prev.some(t => t.id === updatedTask.id)
                        if (exists) {
                            return prev.map(t => t.id === updatedTask.id ? { ...t, ...updatedTask } : t)
                        }
                        return [updatedTask, ...prev]
                    })
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
                            <label className="text-sm font-medium mb-2 block">{t('tasks.status')}</label>
                            <div className="space-y-2">
                                {[
                                    { value: 'TODO', label: t('tasks.statusTodo') },
                                    { value: 'IN_PROGRESS', label: t('tasks.statusInProgress') },
                                    { value: 'DONE', label: t('tasks.statusDone') },
                                    { value: 'OVERDUE', label: t('tasks.statusOverdue') }
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
                            <label className="text-sm font-medium mb-2 block">{t('tasks.deadline')}</label>
                            <div className="space-y-2">
                                {[
                                    { value: 'today', label: t('timeEntries.today') },
                                    { value: 'thisWeek', label: 'This week' },
                                    { value: 'overdue', label: t('tasks.statusOverdue') }
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
                            <label className="text-sm font-medium mb-2 block">{t('tasks.priority')}</label>
                            <div className="space-y-2">
                                {[
                                    { value: 'high', label: t('tasks.priorityHigh') },
                                    { value: 'medium', label: t('tasks.priorityMedium') },
                                    { value: 'low', label: t('tasks.priorityLow') }
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
                            <label className="text-sm font-medium mb-2 block">{t('tasks.assignToLabel')}</label>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {[...users].sort((a, b) => {
                                    if (a.id === currentUserId) return -1;
                                    if (b.id === currentUserId) return 1;
                                    return 0;
                                }).map(user => (
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
                            <label className="text-sm font-medium mb-2 block">{t('tasks.personalScope')}</label>
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
                                        {t('tasks.assignedToMe')}
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
                                        {t('tasks.tasksICreated')}
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
