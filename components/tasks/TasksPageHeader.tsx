"use client"

import { useLanguage } from "@/lib/useLanguage"
import { CreateTaskDialog } from "./CreateTaskDialog"

interface TasksPageHeaderProps {
    isAdmin: boolean
    users: { id: string; name: string | null; email: string | null }[]
    currentUserId: string
}

export function TasksPageHeader({ isAdmin, users, currentUserId }: TasksPageHeaderProps) {
    const { t } = useLanguage()
    
    return (
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t('tasks.title')}</h1>
                <p className="text-muted-foreground">
                    {isAdmin ? t('tasks.manageAndAssign') : t('tasks.yourAssignedTasks')}
                </p>
            </div>
            <CreateTaskDialog
                users={users}
                currentUserId={currentUserId}
            />
        </div>
    )
}

