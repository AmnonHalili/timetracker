"use client"

import { useState, useRef, useCallback } from "react"
import { TasksPageHeader } from "./TasksPageHeader"
import { TasksView } from "./TasksView"

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
        checklist: Array<{ id: string; text: string; isDone: boolean }>;
        subtasks?: Array<{ id: string; title: string; isDone: boolean }>;
        createdAt?: Date | string;
    }>
    tasksWithActiveTimers?: Record<string, Array<{ id: string; name: string | null }>>
}

export function TasksPageWithOptimisticUpdate({
    isAdmin,
    users,
    currentUserId,
    initialTasks,
    tasksWithActiveTimers
}: TasksPageWithOptimisticUpdateProps) {
    const [tasks, setTasks] = useState(initialTasks)

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
            return [task as typeof initialTasks[0], ...prev]
        })
    }, [initialTasks])

    return (
        <div className="container mx-auto space-y-8">
            <TasksPageHeader
                isAdmin={isAdmin}
                users={users}
                currentUserId={currentUserId}
                onOptimisticTaskCreate={handleOptimisticTaskCreate}
            />

            <TasksView
                initialTasks={tasks}
                users={users}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                tasksWithActiveTimers={tasksWithActiveTimers}
            />
        </div>
    )
}

