"use client"

import { useLanguage } from "@/lib/useLanguage"
import { CreateTaskDialog } from "./CreateTaskDialog"
import { Button } from "@/components/ui/button"
import { Filter, ArrowUpDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

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

export function TasksPageHeader({ 
    isAdmin, 
    users, 
    currentUserId, 
    onOptimisticTaskCreate,
    isFiltersOpen,
    setIsFiltersOpen,
    sortBy,
    setSortBy,
    activeFiltersCount = 0,
    isRTL
}: TasksPageHeaderProps) {
    const { t } = useLanguage()

    return (
        <div className="flex flex-col gap-1.5 px-4 md:px-0">
            {/* Title and Add Task - Same row on desktop */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground leading-tight">{t('tasks.title')}</h1>
                    <p className="text-xs md:text-sm text-muted-foreground font-normal leading-relaxed">
                        {isAdmin ? t('tasks.manageAndAssign') : t('tasks.yourAssignedTasks')}
                    </p>
                </div>
                
                {/* Add Task Button - Right aligned on desktop */}
                <div className="flex md:justify-end">
                    <div className="w-full md:w-auto">
                        <CreateTaskDialog
                            users={users}
                            currentUserId={currentUserId}
                            onOptimisticTaskCreate={onOptimisticTaskCreate}
                        />
                    </div>
                </div>
            </div>

            {/* Filters and Sort - Below, right aligned on desktop */}
            {setIsFiltersOpen && setSortBy && (
                <div className={`flex items-center gap-2 md:gap-2 w-full md:w-auto md:justify-end mt-2 md:mt-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    {/* Filters Button */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsFiltersOpen(true)}
                        className={`h-11 md:h-10 text-sm font-semibold flex-1 md:flex-initial rounded-xl md:rounded-md ${isRTL ? 'flex-row-reverse' : ''}`}
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
                        <SelectTrigger className="h-11 md:h-10 text-sm font-semibold px-4 md:px-3 flex-1 md:flex-initial md:w-auto rounded-xl md:rounded-md">
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
            )}
        </div>
    )
}

