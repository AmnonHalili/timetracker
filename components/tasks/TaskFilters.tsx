"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { useLanguage } from "@/lib/useLanguage"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"
import { Filter, X, Check, Calendar, AlertCircle, User, Layout, UserCircle } from "lucide-react"

interface TaskFiltersProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    filters: {
        status: string[];
        deadline: string[];
        priority: string[];
        createdByMe: boolean;
        assignedToMe: boolean;
        users: string[];
    }
    setFilters: React.Dispatch<React.SetStateAction<{
        status: string[];
        deadline: string[];
        priority: string[];
        createdByMe: boolean;
        assignedToMe: boolean;
        users: string[];
    }>>
    users: Array<{ id: string; name: string | null; email: string | null }>
    currentUserId?: string
    clearAllFilters: () => void
}

export function TaskFilters({
    open,
    onOpenChange,
    filters,
    setFilters,
    users,
    currentUserId,
    clearAllFilters
}: TaskFiltersProps) {
    const { t, isRTL } = useLanguage()
    const isDesktop = useMediaQuery("(min-width: 768px)")

    const FilterSection = ({
        title,
        icon: Icon,
        children
    }: {
        title: string,
        icon: any,
        children: React.ReactNode
    }) => (
        <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <Icon className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{title}</h3>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-1">
                {children}
            </div>
        </div>
    )

    const FilterItem = ({
        id,
        label,
        checked,
        onCheckedChange
    }: {
        id: string,
        label: string,
        checked: boolean,
        onCheckedChange: (checked: boolean) => void
    }) => (
        <label
            htmlFor={id}
            className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-pointer group",
                checked
                    ? "bg-primary/5 border-primary shadow-sm"
                    : "bg-background border-border hover:border-primary/50 hover:bg-muted/30"
            )}
        >
            <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={onCheckedChange}
                className="h-5 w-5 rounded-full"
            />
            <span className={cn(
                "text-sm font-medium transition-colors",
                checked ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            )}>
                {label}
            </span>
            {checked && <Check className="h-3 ml-auto text-primary" />}
        </label>
    )

    const Content = () => (
        <div className="space-y-8 py-2">
            {/* Status Filter */}
            <FilterSection title={t('tasks.status')} icon={Layout}>
                {[
                    { value: 'TODO', label: t('tasks.statusTodo') },
                    { value: 'IN_PROGRESS', label: t('tasks.statusInProgress') },
                    { value: 'DONE', label: t('tasks.statusDone') },
                    { value: 'OVERDUE', label: t('tasks.statusOverdue') }
                ].map(status => (
                    <FilterItem
                        key={status.value}
                        id={`status-${status.value}`}
                        label={status.label}
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
                ))}
            </FilterSection>

            {/* Deadline Filter */}
            <FilterSection title={t('tasks.deadline')} icon={Calendar}>
                {[
                    { value: 'today', label: t('timeEntries.today') },
                    { value: 'thisWeek', label: t('tasks.thisWeek') || 'This week' },
                    { value: 'overdue', label: t('tasks.statusOverdue') }
                ].map(option => (
                    <FilterItem
                        key={option.value}
                        id={`deadline-${option.value}`}
                        label={option.label}
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
                ))}
            </FilterSection>

            {/* Priority Filter */}
            <FilterSection title={t('tasks.priority')} icon={AlertCircle}>
                {[
                    { value: 'high', label: t('tasks.priorityHigh') },
                    { value: 'medium', label: t('tasks.priorityMedium') },
                    { value: 'low', label: t('tasks.priorityLow') }
                ].map(priority => (
                    <FilterItem
                        key={priority.value}
                        id={`priority-${priority.value}`}
                        label={priority.label}
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
                ))}
            </FilterSection>

            {/* Users Filter */}
            <FilterSection title={t('tasks.assignToLabel')} icon={UserCircle}>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 thin-scrollbar">
                    {[...users].sort((a, b) => {
                        if (a.id === currentUserId) return -1;
                        if (b.id === currentUserId) return 1;
                        return 0;
                    }).map(user => (
                        <FilterItem
                            key={user.id}
                            id={`user-filter-${user.id}`}
                            label={`${user.name || user.email}${currentUserId && user.id === currentUserId ? ` (${t('common.you')})` : ''}`}
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
                    ))}
                </div>
            </FilterSection>

            {/* Personal Scope Filters */}
            <FilterSection title={t('tasks.personalScope')} icon={User}>
                <FilterItem
                    id="assignedToMe"
                    label={t('tasks.assignedToMe')}
                    checked={filters.assignedToMe}
                    onCheckedChange={(checked) => {
                        setFilters(prev => ({ ...prev, assignedToMe: checked }))
                    }}
                />
                <FilterItem
                    id="createdByMe"
                    label={t('tasks.tasksICreated')}
                    checked={filters.createdByMe}
                    onCheckedChange={(checked) => {
                        setFilters(prev => ({ ...prev, createdByMe: checked }))
                    }}
                />
            </FilterSection>
        </div>
    )

    const Footer = () => (
        <div className="flex items-center gap-3 pt-4 border-t sticky bottom-0 bg-background pb-2">
            <Button
                variant="outline"
                onClick={clearAllFilters}
                className="flex-1"
            >
                {t('common.clearAll')}
            </Button>
            <Button
                onClick={() => onOpenChange(false)}
                className="flex-[2]"
            >
                {t('common.apply') || 'Apply'}
            </Button>
        </div>
    )

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent
                    className="max-w-md max-h-[85vh] overflow-hidden flex flex-col"
                    dir={isRTL ? "rtl" : "ltr"}
                >
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            {t('tasks.filters')}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto px-1 py-4 thin-scrollbar">
                        <Content />
                    </div>
                    <Footer />
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="h-[90vh] sm:h-[85vh] rounded-t-[20px] flex flex-col px-6"
                dir={isRTL ? "rtl" : "ltr"}
            >
                <SheetHeader className="pb-4">
                    <SheetTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        {t('tasks.filters')}
                    </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-1 thin-scrollbar">
                    <Content />
                </div>
                <Footer />
            </SheetContent>
        </Sheet>
    )
}
