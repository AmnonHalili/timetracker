"use client"

import { useState, useRef, useCallback } from "react"
import { TasksPageHeader } from "./TasksPageHeader"
import { TasksView } from "./TasksView"
import { useLanguage } from "@/lib/useLanguage"

interface TasksPageWithOptimisticUpdateProps {
    isAdmin: boolean
    users: Array<{ id: string; name: string | null; email: string | null }>
    currentUserId: string
    initialTasks: Array<{
        id: string;
        title: string;
        status: string;
        priority: string;
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
    tasksWithActiveTimers?: Record<string, Array<{ id: string; name: string | null }>>
    labels?: Array<{ id: string; name: string; color: string }>
}

export function TasksPageWithOptimisticUpdate({
    isAdmin,
    users,
    currentUserId,
    initialTasks,
    tasksWithActiveTimers,
    labels
}: TasksPageWithOptimisticUpdateProps) {
    const [tasks, setTasks] = useState(initialTasks)
    const { isRTL } = useLanguage()

    // Filters and Sort state - lifted to parent to share with header
    const [isFiltersOpen, setIsFiltersOpen] = useState(false)
    const [sortBy, setSortBy] = useState<string>("smart")
    const [activeFiltersCount, setActiveFiltersCount] = useState(0)
    const [showArchived, setShowArchived] = useState(false)

    // Sync tasks when initialTasks changes (from server refresh)
    const prevInitialTasksRef = useRef(initialTasks)
    if (prevInitialTasksRef.current !== initialTasks) {
        prevInitialTasksRef.current = initialTasks
        setTasks(initialTasks)
    }

    const handleOptimisticTaskCreate = useCallback((task: {
        id: string
        title: string
        priority: string
        deadline: Date | null
        description: string | null
        status: string
        assignees: Array<{ id: string; name: string | null; email: string | null }>
        subtasks?: Array<{
            id: string;
            title: string;
            isDone: boolean;
            priority?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
            assignedToId?: string | null;
            assignedTo?: { id: string; name: string | null; image?: string | null } | null;
            startDate?: Date | string | null;
            dueDate?: Date | string | null;
        }>
        createdAt: Date
        updatedAt: Date
    }) => {
        // Add task to local state immediately
        setTasks(prev => {
            // Check if task already exists (in case of refresh)
            if (prev.some(t => t.id === task.id)) {
                return prev
            }
            // Add task at the beginning of the list
            const newTask = {
                ...task,
                checklist: [],
                subtasks: task.subtasks || []
            }
            return [newTask as typeof initialTasks[0], ...prev]
        })
    }, [])

    return (
        <div className="w-full space-y-2 md:space-y-8 relative">
            <TasksPageHeader
                isAdmin={isAdmin}
                users={users}
                currentUserId={currentUserId}
                onOptimisticTaskCreate={handleOptimisticTaskCreate}
                setIsFiltersOpen={setIsFiltersOpen}
                sortBy={sortBy}
                setSortBy={setSortBy}
                activeFiltersCount={activeFiltersCount}
                isRTL={isRTL}
                showArchived={showArchived}
                setShowArchived={setShowArchived}
            />

            <TasksView
                initialTasks={tasks}
                users={users}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                tasksWithActiveTimers={tasksWithActiveTimers}
                labels={labels}
                isFiltersOpen={isFiltersOpen}
                setIsFiltersOpen={setIsFiltersOpen}
                sortBy={sortBy}
                setSortBy={setSortBy}
                onActiveFiltersCountChange={setActiveFiltersCount}
                showArchived={showArchived}
            />
        </div>
    )
}

