"use client"

import { useLanguage } from "@/lib/useLanguage"
import { CreateTaskDialog } from "./CreateTaskDialog"

interface TasksPageHeaderProps {
    isAdmin: boolean
    users: { id: string; name: string | null; email: string | null }[]
    currentUserId: string
    onOptimisticTaskCreate?: (task: {
        id: string
        title: string
        priority: string
        deadline: Date | null
        description: string | null
        status: string
        assignees: Array<{ id: string; name: string | null; email: string | null }>
        createdAt: Date
        updatedAt: Date
    }) => void
}

export function TasksPageHeader({ isAdmin, users, currentUserId, onOptimisticTaskCreate }: TasksPageHeaderProps) {
    const { t } = useLanguage()

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t('tasks.title')}</h1>
                <p className="text-muted-foreground">
                    {isAdmin ? t('tasks.manageAndAssign') : t('tasks.yourAssignedTasks')}
                </p>
            </div>
            <CreateTaskDialog
                users={users}
                currentUserId={currentUserId}
                onOptimisticTaskCreate={onOptimisticTaskCreate}
            />
        </div>
    )
}

