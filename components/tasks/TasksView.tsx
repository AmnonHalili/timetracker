"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, useRef, useTransition } from "react"
import { Trash2, Plus, MoreVertical, Pencil, Play, Square, CheckCircle2, AlertCircle, X, Archive } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
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
import { TaskFilters } from "./TaskFilters"
import { SwipeableTaskCard } from "./SwipeableTaskCard"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"


import { useLanguage } from "@/lib/useLanguage"
import confetti from "canvas-confetti"
import { TasksBoard } from "./board/TasksBoard"
import { toast } from "sonner"

const getPriorityColor = (priority: string) => {
    // Dynamic theme-based colors using CSS variables (handled by Tailwind)
    // High: Solid primary color (100% opacity)
    // Medium: 50% opacity primary (more distinct from HIGH)
    // Low: 25% opacity primary (more distinct from MEDIUM)
    switch (priority) {
        case 'HIGH':
            return 'bg-primary text-primary-foreground border-transparent'
        case 'MEDIUM':
            return 'bg-primary/65 text-primary-foreground border-transparent'
        case 'LOW':
            return 'bg-primary/25 text-primary-foreground border-transparent'
        default:
            return 'bg-muted text-muted-foreground border-border'
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formatDueDateIndicator = (dueDate: Date | string | null, t: any): { text: string; className: string } | null => {
    if (!dueDate) return null

    const due = new Date(dueDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)

    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
        return { text: t('tasks.subtaskDueToday'), className: 'text-orange-600 dark:text-orange-400' }
    } else if (diffDays < 0) {
        return {
            text: t('tasks.subtaskOverdue').replace('{days}', Math.abs(diffDays).toString()),
            className: 'text-red-600 dark:text-red-400 font-medium'
        }
    } else if (diffDays <= 3) {
        return {
            text: t('tasks.subtaskDueSoon').replace('{days}', diffDays.toString()),
            className: 'text-yellow-600 dark:text-yellow-400'
        }
    } else {
        return {
            text: t('tasks.subtaskDueSoon').replace('{days}', diffDays.toString()),
            className: 'text-muted-foreground'
        }
    }
}

// Calculate deadline progress percentage (0-100)
// Returns percentage of time elapsed (how much time has passed)
// Calculates based on days, not milliseconds, for accurate day-based progress
const calculateDeadlineProgress = (startDate: Date | string | null | undefined, deadline: Date | string | null): number => {
    if (!deadline) return 0

    const now = new Date()
    const deadlineDate = new Date(deadline)

    // If no start date, use today as start
    if (!startDate) {
        // If deadline has passed, show 100% (all time passed)
        if (deadlineDate < now) return 100
        // If deadline is today or in future, show 0% (no time passed yet)
        return 0
    }

    const start = new Date(startDate)

    // Normalize dates to start of day for accurate day calculations
    const startOfStart = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const startOfDeadline = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate())
    const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Calculate total number of days (inclusive: start day + all days until deadline)
    // Example: Jan 6 to Jan 8 = 3 days (6, 7, 8)
    const totalDays = Math.ceil((startOfDeadline.getTime() - startOfStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // If total days is 0 or negative, return 0
    if (totalDays <= 0) return 0

    // If deadline has passed, return 100% (all time passed)
    if (startOfDeadline < startOfNow) return 100

    // If start date is in the future, return 0% (no time passed yet)
    if (startOfStart > startOfNow) return 0

    // Calculate elapsed days (inclusive: start day + all days until today)
    // Example: Jan 6 to Jan 7 = 2 days (6, 7)
    const elapsedDays = Math.ceil((startOfNow.getTime() - startOfStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

    // Calculate percentage of time elapsed
    const progress = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100))

    return progress
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
        subtasks?: Array<{
            id: string;
            title: string;
            isDone: boolean;
            priority?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
            assignedToId?: string | null;
            assignedTo?: { id: string; name: string | null; image?: string | null } | null;
            startDate?: Date | string | null;
            dueDate?: Date | string | null;
        }>;
        createdAt?: Date | string;
        isArchived?: boolean;
        archivedAt?: Date | string | null;
    }>
    users: User[]
    isAdmin: boolean
    currentUserId?: string
    tasksWithActiveTimers?: Record<string, Array<{ id: string; name: string | null }>> // Map of task IDs to users actively working on them
    labels?: Array<{ id: string; name: string; color: string }>
    isFiltersOpen?: boolean
    setIsFiltersOpen?: (open: boolean) => void
    sortBy?: string
    setSortBy?: (sortBy: string) => void
    onActiveFiltersCountChange?: (count: number) => void
    showArchived?: boolean
}

export function TasksView({
    initialTasks,
    users,
    isAdmin,
    currentUserId,
    tasksWithActiveTimers = {},
    labels = [],
    isFiltersOpen: externalIsFiltersOpen,
    setIsFiltersOpen: externalSetIsFiltersOpen,
    sortBy: externalSortBy,
    showArchived: externalShowArchived = false
}: TasksViewProps) {
    const router = useRouter()
    const [, startTransition] = useTransition()
    const { t, isRTL, language } = useLanguage()
    const dateLocale = language === 'he' ? he : undefined
    const [tasks, setTasks] = useState(initialTasks)
    const [newSubtaskTitle, setNewSubtaskTitle] = useState<Record<string, string>>({})
    const [editingSubtask, setEditingSubtask] = useState<{ taskId: string; subtaskId: string } | null>(null)
    const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("")

    // Enhanced subtask editing state
    const [editingEnhancedSubtask, setEditingEnhancedSubtask] = useState<{
        taskId: string;
        subtaskId: string;
        title: string;
        priority: 'LOW' | 'MEDIUM' | 'HIGH' | null;
        assignedToId: string | null;
        startDate: Date | null;
        dueDate: Date | null;
    } | null>(null)

    const [localSubtasks, setLocalSubtasks] = useState<Record<string, Array<{
        id: string;
        title: string;
        isDone: boolean;
        priority?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
        assignedToId?: string | null;
        assignedTo?: { id: string; name: string | null; image?: string | null } | null;
        startDate?: Date | string | null;
        dueDate?: Date | string | null;
    }>>>({})
    const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({})
    // Initialize visibleSubtasksMap to true for tasks with subtasks (show by default)
    const [visibleSubtasksMap, setVisibleSubtasksMap] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {}
        initialTasks.forEach(task => {
            if (task.subtasks && task.subtasks.length > 0) {
                initial[task.id] = true
            }
        })
        return initial
    })
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
    const [expandedMobileTaskId, setExpandedMobileTaskId] = useState<string | null>(null)

    // Filters and Sort state - use external if provided, otherwise use internal
    const [internalIsFiltersOpen, setInternalIsFiltersOpen] = useState(false)
    const [internalSortBy] = useState<string>("smart")
    const isFiltersOpen = externalIsFiltersOpen !== undefined ? externalIsFiltersOpen : internalIsFiltersOpen
    const setIsFiltersOpen = externalSetIsFiltersOpen || setInternalIsFiltersOpen
    const sortBy = externalSortBy !== undefined ? externalSortBy : internalSortBy


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
    const [viewMode] = useState<'list' | 'board'>('list')
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
    const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
    const [taskToArchive, setTaskToArchive] = useState<string | null>(null)
    const showArchived = externalShowArchived

    // Sync local state when server data changes (e.g., after task creation)
    useEffect(() => {
        setTasks(initialTasks)

        // Sync subtasks from server data
        const subtasksMap: Record<string, Array<{
            id: string;
            title: string;
            isDone: boolean;
            priority?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
            assignedToId?: string | null;
            assignedTo?: { id: string; name: string | null; image?: string | null } | null;
            startDate?: Date | string | null;
            dueDate?: Date | string | null;
        }>> = {}
        initialTasks.forEach(task => {
            if (task.subtasks && task.subtasks.length > 0) {
                subtasksMap[task.id] = task.subtasks.map((st: {
                    id: string;
                    title: string;
                    isDone: boolean;
                    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
                    assignedToId?: string | null;
                    assignedTo?: { id: string; name: string | null; image?: string | null } | null;
                    startDate?: Date | string | null;
                    dueDate?: Date | string | null;
                }) => ({
                    id: st.id,
                    title: st.title,
                    isDone: st.isDone,
                    priority: st.priority || null,
                    assignedToId: st.assignedToId || null,
                    assignedTo: st.assignedTo || null,
                    startDate: st.startDate || null,
                    dueDate: st.dueDate || null
                }))
            }
        })
        setLocalSubtasks(subtasksMap)

        // Auto-show subtasks for tasks that have them (show by default)
        setVisibleSubtasksMap(prev => {
            const updated = { ...prev }
            initialTasks.forEach(task => {
                const hasSubtasks = (task.subtasks && task.subtasks.length > 0) || (subtasksMap[task.id] && subtasksMap[task.id].length > 0)
                if (hasSubtasks && updated[task.id] === undefined) {
                    updated[task.id] = true // Show by default if not explicitly hidden
                }
            })
            return updated
        })
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
        // Archive filter - must be checked first
        // Treat undefined as false (not archived)
        const isArchived = task.isArchived ?? false
        
        if (showArchived) {
            // Show only archived tasks
            if (!isArchived) {
                return false
            }
        } else {
            // Show only non-archived tasks
            if (isArchived) {
                return false
            }
        }

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
            toast.error(t('tasks.updateError') || "Failed to update task status")
        }
    }

    const handleDelete = (id: string) => {
        setTaskToDelete(id)
        setDeleteDialogOpen(true)
    }

    const confirmDelete = async () => {
        if (!taskToDelete) return

        const id = taskToDelete
        setDeleteDialogOpen(false)

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
                setTaskToDelete(null)
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
                toast.error(error.message || t('tasks.deleteError') || "Failed to delete task. Please try again.")
                setTaskToDelete(null)
            })
    }

    const [isArchiving, setIsArchiving] = useState(false)

    const handleArchive = (id: string) => {
        const task = tasks.find(t => t.id === id)
        const isCurrentlyArchived = task?.isArchived ?? false
        setTaskToArchive(id)
        setIsArchiving(!isCurrentlyArchived) // true for archive, false for unarchive
        setArchiveDialogOpen(true)
    }

    const confirmArchive = async () => {
        if (!taskToArchive) return

        const id = taskToArchive
        const shouldArchive = isArchiving
        setArchiveDialogOpen(false)

        // Store the task for potential revert
        const taskToUpdate = tasks.find(t => t.id === id)
        if (!taskToUpdate) return

        // Optimistic update: Mark as archived/unarchived immediately
        setTasks(prev => prev.map(t => 
            t.id === id 
                ? { 
                    ...t, 
                    isArchived: shouldArchive, 
                    archivedAt: shouldArchive ? new Date().toISOString() : null 
                }
                : t
        ))

        // Fire and forget - API call in background
        fetch("/api/tasks", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, action: shouldArchive ? 'archive' : 'unarchive' })
        })
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    const errorMessage = data.error || data.message || (shouldArchive ? "Failed to archive task" : "Failed to unarchive task")
                    console.error("Archive API error:", errorMessage, data)
                    throw new Error(errorMessage)
                }
                const updatedTask = await res.json()
                // Update the task with server response to ensure consistency
                setTasks(prev => prev.map(t => 
                    t.id === id 
                        ? { 
                            ...t, 
                            isArchived: updatedTask.isArchived ?? shouldArchive, 
                            archivedAt: updatedTask.archivedAt ?? (shouldArchive ? new Date().toISOString() : null)
                        }
                        : t
                ))
                // Refresh to get updated data from server
                router.refresh()
                setTaskToArchive(null)
                setIsArchiving(false)
                toast.success(shouldArchive 
                    ? (t('tasks.archiveSuccess') || "Task archived successfully")
                    : (t('tasks.unarchiveSuccess') || "Task unarchived successfully")
                )
            })
            .catch((error) => {
                console.error(`Failed to ${shouldArchive ? 'archive' : 'unarchive'} task:`, error)
                // Revert on error - restore the original task
                setTasks(prev => prev.map(t => 
                    t.id === id 
                        ? { 
                            ...t, 
                            isArchived: taskToUpdate.isArchived ?? false, 
                            archivedAt: taskToUpdate.archivedAt ?? null 
                        }
                        : t
                ))
                const errorMessage = error.message || (shouldArchive 
                    ? (t('tasks.archiveError') || "Failed to archive task. Please try again.")
                    : (t('tasks.unarchiveError') || "Failed to unarchive task. Please try again.")
                )
                toast.error(errorMessage)
                setTaskToArchive(null)
                setIsArchiving(false)
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
        const currentSubtasksCount = (localSubtasks[taskId] || []).length
        setLocalSubtasks(prev => ({
            ...prev,
            [taskId]: [...(prev[taskId] || []), { id: tempId, title: titleToSave, isDone: false }]
        }))

        // Auto-show subtasks when first subtask is added (if it's the first one)
        if (currentSubtasksCount === 0) {
            setVisibleSubtasksMap(prev => ({ ...prev, [taskId]: true }))
        }

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
                        s.id === tempId ? {
                            id: newSubtask.id,
                            title: newSubtask.title,
                            isDone: newSubtask.isDone || false,
                            priority: newSubtask.priority || null,
                            assignedToId: newSubtask.assignedToId || null,
                            assignedTo: newSubtask.assignedTo || null,
                            dueDate: newSubtask.dueDate || null
                        } : s
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
                toast.error(error instanceof Error ? error.message : (t('tasks.addSubtaskError') || "Failed to add subtask"))
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



    const handleUpdateSubtask = async (
        taskId: string,
        subtaskId: string,
        updates?: {
            title?: string;
            priority?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
            assignedToId?: string | null;
            startDate?: Date | null;
            dueDate?: Date | null;
        }
    ) => {
        // Build update data object
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: {
            title?: string;
            priority?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
            assignedToId?: string | null;
            startDate?: string | null;
            dueDate?: string | null;
        } = {}

        if (updates?.title !== undefined) {
            const trimmed = updates.title.trim()
            if (!trimmed) {
                setEditingSubtask(null)
                return
            }
            updateData.title = trimmed
        } else if (!updates) {
            // Legacy title update from editingSubtaskTitle
            const trimmedTitle = editingSubtaskTitle.trim()
            if (!trimmedTitle) {
                setEditingSubtask(null)
                return
            }
            updateData.title = trimmedTitle
        }

        // Add other updates
        if (updates?.priority !== undefined) updateData.priority = updates.priority
        if (updates?.assignedToId !== undefined) updateData.assignedToId = updates.assignedToId
        if (updates?.startDate !== undefined) {
            updateData.startDate = updates.startDate ? updates.startDate.toISOString() : null
        }
        if (updates?.dueDate !== undefined) {
            updateData.dueDate = updates.dueDate ? updates.dueDate.toISOString() : null
        }

        // Validate assignee if being updated
        if (updates?.assignedToId !== undefined && updates.assignedToId !== null) {
            const parentTask = tasks.find(t => t.id === taskId)
            const isValidAssignee = parentTask?.assignees.some(a => a.id === updates.assignedToId)
            if (!isValidAssignee) {
                toast.error("Assigned user must be from parent task assignees")
                return
            }
        }

        // Store previous state for revert
        const previousSubtasks = localSubtasks[taskId] || []
        const previousSubtask = previousSubtasks.find(s => s.id === subtaskId)

        // Optimistic update
        setLocalSubtasks(prev => ({
            ...prev,
            [taskId]: (prev[taskId] || []).map(s =>
                s.id === subtaskId ? { ...s, ...updateData } : s
            )
        }))

        setEditingSubtask(null)

        try {
            const res = await fetch("/api/tasks/subtasks", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: subtaskId, ...updateData })
            })

            if (!res.ok) {
                throw new Error("Failed to update subtask")
            }

            const updated = await res.json()

            // Update with server response (includes assignedTo populated)
            setLocalSubtasks(prev => ({
                ...prev,
                [taskId]: (prev[taskId] || []).map(s =>
                    s.id === subtaskId ? {
                        ...s,
                        ...updateData,
                        assignedTo: updated.assignedTo || s.assignedTo
                    } : s
                )
            }))

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
            toast.error("Failed to update subtask")
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

    const handleDeleteSubtask = (taskId: string, subtaskId: string) => {
        // Skip if operation is already pending
        if (pendingOperations.current.has(subtaskId)) {
            return
        }

        pendingOperations.current.add(subtaskId)

        // Store previous state for potential revert
        const previousSubtasks = localSubtasks[taskId] || []
        const deletedSubtask = previousSubtasks.find(s => s.id === subtaskId)

        // Optimistic update - remove IMMEDIATELY (synchronous, no await)
        setLocalSubtasks(prev => ({
            ...prev,
            [taskId]: (prev[taskId] || []).filter(s => s.id !== subtaskId)
        }))

        // Fire and forget - API call happens in background, doesn't block UI
        fetch(`/api/tasks/subtasks?id=${subtaskId}`, { method: "DELETE" })
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error("Failed to delete subtask")
                }
                // Refresh in background without blocking (using startTransition for smooth updates)
                startTransition(() => {
                    router.refresh()
                })
            })
            .catch((error) => {
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
                    toast.error("Failed to delete subtask. Please try again.")
                }
            })
            .finally(() => {
                pendingOperations.current.delete(subtaskId)
            })
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
        <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="flex flex-col space-y-4 pb-4 px-0 bg-transparent">
                {/* Title */}
                <CardTitle className={`px-4 text-center md:text-left ${isRTL ? 'md:text-right' : 'md:text-left'} text-base md:text-lg font-medium text-primary`}>
                    {t('tasks.allTasks')} ({filteredTasks.length})
                </CardTitle>

                {/* Active Filter Chips */}
                {activeFiltersCount > 0 && (
                    <div className="flex overflow-x-auto md:flex-wrap gap-1.5 items-center px-4 md:px-0 pb-2 md:pb-0 mask-fade-right md:mask-none no-scrollbar">
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
            <CardContent className="p-0 bg-transparent">
                {viewMode === 'board' ? (
                    <div className="h-[calc(100vh-250px)] px-4 pb-4 bg-muted/30 dark:bg-muted/20 rounded-md">
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
                    <>
                        <div className="hidden md:block rounded-md border border-border overflow-hidden bg-muted/30 dark:bg-muted/20 w-full">
                            <table className="w-full text-sm" style={{ tableLayout: 'fixed', width: '100%' }}>
                                <colgroup>
                                    <col style={{ width: '55%' }} />
                                    <col style={{ width: '12%' }} />
                                    <col style={{ width: '11%' }} />
                                    <col style={{ width: '11%' }} />
                                    <col style={{ width: '11%' }} />
                                </colgroup>
                                <thead className="bg-muted/40 sticky top-0 z-40 border-b border-border">
                                    <tr className="border-b border-border/50">
                                        <th className="h-10 px-4 text-left font-normal text-muted-foreground bg-muted/20 first:rounded-tl-md">
                                            {t('tasks.title') || 'Task'}
                                        </th>
                                        <th className="h-10 px-4 text-center font-normal text-muted-foreground bg-muted/20">
                                            {t('tasks.assignToLabel') || 'Assigned to'}
                                        </th>
                                        {/* Priority */}
                                        <th className="h-10 px-4 text-center font-normal text-muted-foreground bg-muted/20">
                                            {t('tasks.priority') || 'Priority'}
                                        </th>
                                        {/* Date */}
                                        <th className="h-10 px-4 text-center font-normal text-muted-foreground bg-muted/20">
                                            {t('tasks.date') || 'Date'}
                                        </th>
                                        {/* Status */}
                                        <th className="h-10 px-4 text-center font-normal text-muted-foreground bg-muted/20 last:rounded-tr-md">
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
                                                                                onClick={() => handleArchive(task.id)}
                                                                            >
                                                                                <Archive className="h-4 w-4 mr-2" />
                                                                                {(task.isArchived ?? false) ? t('tasks.unarchive') : t('tasks.archive')}
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
                                                            (() => {
                                                                const deadline = task.deadline ? new Date(task.deadline) : null
                                                                const startDate = task.startDate ? new Date(task.startDate) : null
                                                                const progress = calculateDeadlineProgress(startDate, deadline)
                                                                const isOverdue = deadline && isPast(deadline) && !isToday(deadline) && task.status !== 'DONE'

                                                                // Format date range text
                                                                let dateText = ''
                                                                if (startDate && deadline) {
                                                                    dateText = `${format(startDate, 'MMM d', { locale: dateLocale })} - ${format(deadline, 'MMM d', { locale: dateLocale })}`
                                                                } else if (deadline) {
                                                                    dateText = format(deadline, 'MMM d', { locale: dateLocale })
                                                                } else if (startDate) {
                                                                    dateText = format(startDate, 'MMM d', { locale: dateLocale })
                                                                }

                                                                return (
                                                                    <div className="flex flex-col items-center justify-center gap-1.5 w-full max-w-[160px] mx-auto">
                                                                        {/* Progress Bar Pill */}
                                                                        <div className="relative w-full h-7 rounded-full overflow-hidden border border-border/40 shadow-sm bg-background">
                                                                            {/* Time Passed (dark theme color - left side) */}
                                                                            <div
                                                                                className={`absolute top-0 bottom-0 left-0 transition-all duration-500 ease-out z-0 ${isOverdue
                                                                                    ? 'bg-destructive'
                                                                                    : 'bg-primary'
                                                                                    }`}
                                                                                style={{
                                                                                    width: `${Math.max(0, Math.min(100, progress))}%`
                                                                                }}
                                                                            />
                                                                            {/* Time Remaining (light theme color - right side) */}
                                                                            <div
                                                                                className={`absolute top-0 bottom-0 right-0 transition-all duration-500 ease-out z-0 ${isOverdue
                                                                                    ? 'bg-destructive/50'
                                                                                    : 'bg-primary/50'
                                                                                    }`}
                                                                                style={{
                                                                                    width: `${Math.max(0, Math.min(100, 100 - progress))}%`
                                                                                }}
                                                                            />
                                                                            {/* Date Text Overlay */}
                                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                                                                <span className={`text-[10px] font-semibold px-2 truncate max-w-full drop-shadow-sm ${isOverdue
                                                                                    ? 'text-destructive-foreground'
                                                                                    : 'text-white dark:text-gray-900' // White text in light theme (dark bg), dark text in dark theme (light bg)
                                                                                    }`}>
                                                                                    {dateText}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })()
                                                        ) : (
                                                            <span className="text-muted-foreground/30 text-xs">-</span>
                                                        )}
                                                    </td>

                                                    {/* Status */}
                                                    <td className="p-1 align-middle text-center">
                                                        <div
                                                            className={`
                                                    h-8 w-full max-w-[140px] mx-auto flex items-center justify-center gap-2 text-xs font-semibold shadow-sm rounded-md transition-all
                                                    ${task.status === 'DONE' ? 'bg-[#00c875] hover:bg-[#00c875]/90 text-white' :
                                                                    isPast(new Date(task.deadline || '')) && !isToday(new Date(task.deadline || '')) && task.status !== 'DONE' ? 'bg-[#e2445c] hover:bg-[#d00000] text-white' :
                                                                        task.status === 'IN_PROGRESS' || (tasksWithActiveTimers[task.id] && tasksWithActiveTimers[task.id].length > 0) ? 'bg-[#fdab3d] hover:bg-[#fdab3d]/90 text-white' :
                                                                            task.status === 'BLOCKED' ? 'bg-[#e2445c] hover:bg-[#c93b51] text-white' :
                                                                                task.status === 'TODO' && !((tasksWithActiveTimers[task.id] && tasksWithActiveTimers[task.id].length > 0)) ? 'bg-muted hover:bg-muted/80 text-muted-foreground' : ''}
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
                                                                                    : (tasksWithActiveTimers[task.id][0].id === currentUserId
                                                                                        ? (t('tasks.youAreOnIt') || 'You are on it')
                                                                                        : t('tasks.userIsWorking').replace('{name}', tasksWithActiveTimers[task.id][0].name?.split(' ')[0] || 'User')))
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
                                                                    <tr key={subtask.id} className="group/subtask bg-muted/3 hover:bg-muted/8 relative">
                                                                        {/* Title Column (nested) */}
                                                                        <td className="p-1.5 pl-12 border-r border-border/30 relative">
                                                                            {/* Continuous Hierarchy Line */}
                                                                            <div className="absolute left-[36px] top-0 bottom-0 w-[1px] bg-border/40 group-last/subtask:bottom-1/2"></div>
                                                                            {/* Branch Line */}
                                                                            <div className="absolute left-[36px] top-1/2 w-4 h-[1px] bg-border/40"></div>
                                                                            {/* Mask bottom part of line for last item if no "Show More" */}
                                                                            {isLast && !hasMore && (
                                                                                <div className="absolute left-[36px] top-1/2 bottom-0 w-[2px] bg-background translate-x-[-0.5px]"></div>
                                                                            )}

                                                                            <div className="flex items-center gap-2 relative">
                                                                                <Checkbox
                                                                                    checked={subtask.isDone}
                                                                                    className="rounded-full w-3.5 h-3.5 border-2"
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
                                                                                        className="h-6 text-xs"
                                                                                    />
                                                                                ) : (
                                                                                    <span
                                                                                        className={`text-xs truncate cursor-pointer hover:underline ${subtask.isDone ? 'line-through text-muted-foreground' : ''}`}
                                                                                        onClick={() => {
                                                                                            setEditingSubtask({ taskId: task.id, subtaskId: subtask.id })
                                                                                            setEditingSubtaskTitle(subtask.title)
                                                                                        }}
                                                                                    >
                                                                                        {subtask.title}
                                                                                    </span>
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

                                                                                            {/* Edit Enhanced Fields */}
                                                                                            <DropdownMenuItem
                                                                                                onClick={() => {
                                                                                                    setEditingEnhancedSubtask({
                                                                                                        taskId: task.id,
                                                                                                        subtaskId: subtask.id,
                                                                                                        title: subtask.title,
                                                                                                        priority: subtask.priority || null,
                                                                                                        assignedToId: subtask.assignedToId || null,
                                                                                                        startDate: subtask.startDate ? new Date(subtask.startDate) : null,
                                                                                                        dueDate: subtask.dueDate ? new Date(subtask.dueDate) : null
                                                                                                    })
                                                                                                }}
                                                                                                className="cursor-pointer"
                                                                                            >
                                                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                                                Edit Details
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

                                                                        {/* Assigned To - Subtask */}
                                                                        <td className="p-2 border-r border-border/30 w-[80px]">
                                                                            {subtask.assignedTo ? (
                                                                                <div className="flex -space-x-2 overflow-hidden justify-center pl-2">
                                                                                    <Avatar className="inline-block h-6 w-6 rounded-full ring-2 ring-background border bg-muted">
                                                                                        <AvatarFallback className="text-[9px] font-medium bg-primary/10 text-primary">
                                                                                            {subtask.assignedTo.name ? subtask.assignedTo.name.substring(0, 2).toUpperCase() : "??"}
                                                                                        </AvatarFallback>
                                                                                    </Avatar>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-muted-foreground/30 text-[10px]">-</span>
                                                                            )}
                                                                        </td>

                                                                        {/* Priority - Subtask */}
                                                                        <td className="p-1 align-middle text-center border-r border-border/30">
                                                                            {subtask.priority ? (
                                                                                <div className={`
                                                                                    h-6 w-full max-w-[100px] mx-auto flex items-center justify-center gap-1 text-[10px] font-semibold shadow-sm p-1.5 rounded-md border
                                                                                    ${getPriorityColor(subtask.priority)}
                                                                                `}>
                                                                                    <span>{subtask.priority === 'HIGH' ? t('tasks.priorityHigh') : subtask.priority === 'MEDIUM' ? t('tasks.priorityMedium') : t('tasks.priorityLow')}</span>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-muted-foreground/30 text-[10px]">-</span>
                                                                            )}
                                                                        </td>

                                                                        {/* Date - Subtask */}
                                                                        <td className="p-1 align-middle text-center border-r border-border/30">
                                                                            {(subtask.startDate || subtask.dueDate) ? (
                                                                                (() => {
                                                                                    const dueDate = subtask.dueDate ? new Date(subtask.dueDate) : null
                                                                                    const startDate = subtask.startDate ? new Date(subtask.startDate) : null
                                                                                    const progress = calculateDeadlineProgress(startDate, dueDate)
                                                                                    const isOverdue = dueDate && isPast(dueDate) && !isToday(dueDate) && !subtask.isDone

                                                                                    // Format date range text
                                                                                    let dateText = ''
                                                                                    if (startDate && dueDate) {
                                                                                        dateText = `${format(startDate, 'MMM d', { locale: dateLocale })} - ${format(dueDate, 'MMM d', { locale: dateLocale })}`
                                                                                    } else if (dueDate) {
                                                                                        dateText = format(dueDate, 'MMM d', { locale: dateLocale })
                                                                                    } else if (startDate) {
                                                                                        dateText = format(startDate, 'MMM d', { locale: dateLocale })
                                                                                    }

                                                                                    return (
                                                                                        <div className="flex flex-col items-center justify-center gap-1 w-full max-w-[140px] mx-auto">
                                                                                            {/* Progress Bar Pill - Smaller for subtask */}
                                                                                            <div className="relative w-full h-5 rounded-full overflow-hidden border border-border/30 shadow-sm bg-background">
                                                                                                {/* Time Passed */}
                                                                                                <div
                                                                                                    className={`absolute top-0 bottom-0 left-0 transition-all duration-500 ease-out z-0 ${isOverdue
                                                                                                        ? 'bg-destructive/80'
                                                                                                        : 'bg-primary/80'
                                                                                                        }`}
                                                                                                    style={{
                                                                                                        width: `${Math.max(0, Math.min(100, progress))}%`
                                                                                                    }}
                                                                                                />
                                                                                                {/* Time Remaining */}
                                                                                                <div
                                                                                                    className={`absolute top-0 bottom-0 right-0 transition-all duration-500 ease-out z-0 ${isOverdue
                                                                                                        ? 'bg-destructive/40'
                                                                                                        : 'bg-primary/40'
                                                                                                        }`}
                                                                                                    style={{
                                                                                                        width: `${Math.max(0, Math.min(100, 100 - progress))}%`
                                                                                                    }}
                                                                                                />
                                                                                                {/* Date Text Overlay */}
                                                                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                                                                                    <span className={`text-[9px] font-semibold px-1.5 truncate max-w-full drop-shadow-sm ${isOverdue
                                                                                                        ? 'text-destructive-foreground'
                                                                                                        : 'text-white dark:text-gray-900'
                                                                                                        }`}>
                                                                                                        {dateText}
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    )
                                                                                })()
                                                                            ) : (
                                                                                <span className="text-muted-foreground/30 text-[10px]">-</span>
                                                                            )}
                                                                        </td>

                                                                        {/* Status - Subtask (only show if overdue or working, hide if done or todo) */}
                                                                        <td className="p-1 align-middle text-center">
                                                                            {(() => {
                                                                                const isOverdue = subtask.dueDate && isPast(new Date(subtask.dueDate)) && !isToday(new Date(subtask.dueDate)) && !subtask.isDone
                                                                                const hasActiveTimer = tasksWithActiveTimers[subtask.id] && tasksWithActiveTimers[subtask.id].length > 0
                                                                                
                                                                                // Only show status if overdue or has active timer
                                                                                if (isOverdue || hasActiveTimer) {
                                                                                    return (
                                                                                        <div
                                                                                            className={`
                                                                h-6 w-full max-w-[120px] mx-auto flex items-center justify-center gap-1.5 text-[10px] font-semibold shadow-sm rounded-md transition-all
                                                                ${isOverdue ? 'bg-[#e2445c]/80 hover:bg-[#d00000] text-white' :
                                                                    hasActiveTimer ? 'bg-[#fdab3d]/80 hover:bg-[#fdab3d] text-white' : ''}
                                                            `}
                                                                                        >
                                                                                            {isOverdue && <AlertCircle className="h-3 w-3" />}

                                                                                            <span className="truncate">
                                                                                                {isOverdue ? t('tasks.statusOverdue') :
                                                                                                    hasActiveTimer ? (tasksWithActiveTimers[subtask.id].length > 1
                                                                                                        ? t('tasks.usersWorking').replace('{count}', tasksWithActiveTimers[subtask.id].length.toString())
                                                                                                        : (tasksWithActiveTimers[subtask.id][0].id === currentUserId
                                                                                                            ? (t('tasks.youAreOnIt') || 'You are on it')
                                                                                                            : t('tasks.userIsWorking').replace('{name}', tasksWithActiveTimers[subtask.id][0].name?.split(' ')[0] || 'User'))) : ''}
                                                                                            </span>
                                                                                        </div>
                                                                                    )
                                                                                }
                                                                                // Show nothing if done or todo
                                                                                return <span className="text-muted-foreground/30 text-[10px]">-</span>
                                                                            })()}
                                                                        </td>
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
                                                                <td className="p-2"></td>
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
                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-3 pb-20">
                            {filteredTasks.length === 0 ? (
                                <div className="text-center p-8 text-muted-foreground italic bg-muted/20 rounded-lg">
                                    {t('tasks.noTasksFound')}
                                </div>
                            ) : (
                                filteredTasks.map((task) => (
                                    <div key={task.id} className="space-y-3">
                                        <SwipeableTaskCard
                                            task={task}
                                            t={t}
                                            isRTL={isRTL}
                                            getPriorityColor={getPriorityColor}
                                            handleToggleTaskCompletion={handleToggleTaskCompletion}
                                            handleStartWorking={handleStartWorking}
                                            handleStopWorking={handleStopWorking}
                                            handleEdit={(task) => {
                                                setEditingTask(task)
                                                setIsEditDialogOpen(true)
                                            }}
                                            handleDelete={handleDelete}
                                            handleArchive={handleArchive}
                                            onClick={() => {
                                                setSelectedTask(task)
                                                setIsDetailOpen(true)
                                            }}
                                            isTimerRunning={tasksWithActiveTimers[task.id]?.length > 0}
                                            localSubtasks={localSubtasks}
                                            expandedMobileTaskId={expandedMobileTaskId}
                                            setExpandedMobileTaskId={setExpandedMobileTaskId}
                                            handleToggleSubtask={handleToggleSubtask}
                                            formatDueDateIndicator={formatDueDateIndicator}
                                            newSubtaskTitle={newSubtaskTitle}
                                            setNewSubtaskTitle={setNewSubtaskTitle}
                                            handleAddSubtask={handleAddSubtask}
                                            isAdmin={isAdmin}
                                            currentUserId={currentUserId}
                                            visibleSubtasksMap={visibleSubtasksMap}
                                            setVisibleSubtasksMap={setVisibleSubtasksMap}
                                            expandedSubtasks={expandedSubtasks}
                                            setExpandedSubtasks={setExpandedSubtasks}
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}
            </CardContent>

            <TaskDetailDialog
                task={selectedTask ? {
                    ...selectedTask,
                    subtasks: localSubtasks[selectedTask.id] || selectedTask.subtasks || []
                } : null}
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
                onSubtaskToggle={handleToggleSubtask}
                onSubtaskUpdate={handleUpdateSubtask}
                onSubtaskDelete={handleDeleteSubtask}
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

            {/* Task Filters Component */}
            <TaskFilters
                open={isFiltersOpen}
                onOpenChange={setIsFiltersOpen}
                filters={filters}
                setFilters={setFilters}
                users={users}
                currentUserId={currentUserId}
                clearAllFilters={clearAllFilters}
            />

            {/* Delete Task Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('common.delete')}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('tasks.deleteConfirm') || 'Are you sure you want to delete this task? This action cannot be undone.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setTaskToDelete(null)}>
                            {t('common.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {t('common.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Archive/Unarchive Task Confirmation Dialog */}
            <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {isArchiving ? t('tasks.archive') : t('tasks.unarchive')}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {isArchiving 
                                ? (t('tasks.archiveConfirm') || 'Are you sure you want to archive this task? It will be moved to the archive.')
                                : (t('tasks.unarchiveConfirm') || 'Are you sure you want to unarchive this task? It will be moved back to the active tasks.')
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setTaskToArchive(null)
                            setIsArchiving(false)
                        }}>
                            {t('common.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmArchive}
                            className="bg-amber-500 hover:bg-amber-600 text-white"
                        >
                            {isArchiving ? t('tasks.archive') : t('tasks.unarchive')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Enhanced Subtask Edit Dialog */}
            {editingEnhancedSubtask && (() => {
                const task = tasks.find(t => t.id === editingEnhancedSubtask.taskId)
                const subtask = localSubtasks[editingEnhancedSubtask.taskId]?.find(
                    s => s.id === editingEnhancedSubtask.subtaskId
                )

                if (!task || !subtask) return null

                return (
                    <Dialog open={true} onOpenChange={() => setEditingEnhancedSubtask(null)}>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>{t('tasks.editSubtask')}</DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <div>
                                    <label className="text-sm font-medium mb-2 block">
                                        {t('tasks.titleLabel')}
                                    </label>
                                    <Input
                                        value={editingEnhancedSubtask.title}
                                        onChange={(e) => setEditingEnhancedSubtask(prev =>
                                            prev ? {
                                                ...prev,
                                                title: e.target.value
                                            } : null
                                        )}
                                        placeholder={t('tasks.subtaskTitlePlaceholder') || 'Subtask title'}
                                        className="w-full"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium mb-2 block">
                                        {t('tasks.subtaskPriority')}
                                    </label>
                                    <Select
                                        value={editingEnhancedSubtask.priority || 'none'}
                                        onValueChange={(v) => setEditingEnhancedSubtask(prev =>
                                            prev ? {
                                                ...prev,
                                                priority: v === 'none' ? null : v as 'LOW' | 'MEDIUM' | 'HIGH'
                                            } : null
                                        )}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">{t('tasks.subtaskNoPriority')}</SelectItem>
                                            <SelectItem value="HIGH">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className={cn("text-[10px] px-1 h-5 min-w-[1.5rem] justify-center", getPriorityColor('HIGH'))}>H</Badge>
                                                    {t('tasks.priorityHigh')}
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="MEDIUM">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className={cn("text-[10px] px-1 h-5 min-w-[1.5rem] justify-center", getPriorityColor('MEDIUM'))}>M</Badge>
                                                    {t('tasks.priorityMedium')}
                                                </div>
                                            </SelectItem>
                                            <SelectItem value="LOW">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className={cn("text-[10px] px-1 h-5 min-w-[1.5rem] justify-center", getPriorityColor('LOW'))}>L</Badge>
                                                    {t('tasks.priorityLow')}
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium mb-2 block">
                                        {t('tasks.subtaskAssignedTo')}
                                    </label>
                                    <Select
                                        value={editingEnhancedSubtask.assignedToId || 'none'}
                                        onValueChange={(v) => setEditingEnhancedSubtask(prev =>
                                            prev ? {
                                                ...prev,
                                                assignedToId: v === 'none' ? null : v
                                            } : null
                                        )}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">{t('tasks.subtaskNoAssignee')}</SelectItem>
                                            {task.assignees.map(user => (
                                                <SelectItem key={user.id} value={user.id}>
                                                    {user.name || 'Unknown User'}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Only users assigned to the parent task
                                    </p>
                                </div>

                                <div>
                                    <label className="text-sm font-medium mb-2 block">
                                        {t('tasks.startDate')}
                                    </label>
                                    <Input
                                        type="date"
                                        value={editingEnhancedSubtask.startDate
                                            ? editingEnhancedSubtask.startDate.toISOString().split('T')[0]
                                            : ''}
                                        onChange={(e) => setEditingEnhancedSubtask(prev =>
                                            prev ? {
                                                ...prev,
                                                startDate: e.target.value ? new Date(e.target.value) : null
                                            } : null
                                        )}
                                        className="w-full"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium mb-2 block">
                                        {t('tasks.subtaskDueDate')}
                                    </label>
                                    <Input
                                        type="date"
                                        value={editingEnhancedSubtask.dueDate
                                            ? editingEnhancedSubtask.dueDate.toISOString().split('T')[0]
                                            : ''}
                                        onChange={(e) => setEditingEnhancedSubtask(prev =>
                                            prev ? {
                                                ...prev,
                                                dueDate: e.target.value ? new Date(e.target.value) : null
                                            } : null
                                        )}
                                        className="w-full"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => setEditingEnhancedSubtask(null)}
                                >
                                    {t('common.cancel')}
                                </Button>
                                <Button onClick={() => {
                                    if (!editingEnhancedSubtask) return

                                    handleUpdateSubtask(
                                        editingEnhancedSubtask.taskId,
                                        editingEnhancedSubtask.subtaskId,
                                        {
                                            title: editingEnhancedSubtask.title,
                                            priority: editingEnhancedSubtask.priority,
                                            assignedToId: editingEnhancedSubtask.assignedToId,
                                            startDate: editingEnhancedSubtask.startDate,
                                            dueDate: editingEnhancedSubtask.dueDate
                                        }
                                    )
                                    setEditingEnhancedSubtask(null)
                                }}>
                                    {t('common.save')}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )
            })()}
        </Card >
    )
}
