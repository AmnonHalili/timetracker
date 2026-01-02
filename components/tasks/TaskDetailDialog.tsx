"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Clock, Users, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { useLanguage } from "@/lib/useLanguage"

interface TaskDetailDialogProps {
    task: {
        id: string
        title: string
        description: string | null
        status: string
        priority: string
        deadline: Date | string | null
        assignees: Array<{ id: string; name: string | null }>
        checklist: Array<{ id: string; text: string; isDone: boolean }>
        subtasks?: Array<{ id: string; title: string; isDone: boolean }>
    } | null
    open: boolean
    onOpenChange: (open: boolean) => void
    timeEntries?: Array<{
        id: string
        startTime: Date | string
        endTime: Date | string | null
        description: string | null
        subtaskId: string | null
        subtask?: {
            id: string
            title: string
        } | null
        user: {
            id: string
            name: string | null
        }
    }>
}

export function TaskDetailDialog({ task, open, onOpenChange, timeEntries = [] }: TaskDetailDialogProps) {
    const { t, language } = useLanguage()
    const dateLocale = language === 'he' ? he : undefined
    const [showTimeHistory, setShowTimeHistory] = useState(false)
    const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({})

    const toggleSubtask = (subtaskId: string) => {
        setExpandedSubtasks(prev => ({
            ...prev,
            [subtaskId]: !prev[subtaskId]
        }))
    }

    if (!task) return null

    // Calculate total time spent on this task
    const calculateTotalTimeValue = () => {
        let totalSeconds = 0
        timeEntries.forEach(entry => {
            if (entry.endTime) {
                const start = new Date(entry.startTime).getTime()
                const end = new Date(entry.endTime).getTime()
                totalSeconds += Math.floor((end - start) / 1000)
            }
        })
        return totalSeconds
    }

    const calculateTotalTime = () => {
        const totalSeconds = calculateTotalTimeValue()
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60

        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`
        } else {
            return `${seconds}s`
        }
    }

    // Get unique users who worked on this task
    const usersWhoWorked = Array.from(
        new Map(
            timeEntries
                .filter(entry => entry.user)
                .map(entry => [entry.user.id, entry.user])
        ).values()
    )

    // Calculate percentage of subtasks done
    const subtasksDone = task.subtasks?.filter(s => s.isDone).length || 0
    const totalSubtasks = task.subtasks?.length || 0
    const completionPercentage = totalSubtasks > 0
        ? Math.round((subtasksDone / totalSubtasks) * 100)
        : task.status === 'DONE' ? 100 : 0

    // Group time entries by user
    const timeByUser = new Map<string, { user: { id: string; name: string | null }, totalSeconds: number }>()

    timeEntries.forEach(entry => {
        if (entry.endTime && entry.user) {
            const start = new Date(entry.startTime).getTime()
            const end = new Date(entry.endTime).getTime()
            const seconds = Math.floor((end - start) / 1000)

            const existing = timeByUser.get(entry.user.id)
            if (existing) {
                existing.totalSeconds += seconds
            } else {
                timeByUser.set(entry.user.id, {
                    user: entry.user,
                    totalSeconds: seconds
                })
            }
        }
    })

    const formatTime = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60

        if (hours > 0) {
            return `${hours}h ${minutes}m`
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`
        } else {
            return `${seconds}s`
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl">{task.title}</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Description */}
                    {task.description && (
                        <div>
                            <h3 className="text-sm font-semibold mb-2">{t('tasks.description')}</h3>
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                        </div>
                    )}



                    {/* Completion Percentage - Only show if there are subtasks */}
                    {totalSubtasks > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" />
                                Completion: {completionPercentage}%
                            </h3>
                            <div className="w-full bg-muted rounded-full h-2.5">
                                <div
                                    className="bg-primary h-2.5 rounded-full transition-all"
                                    style={{ width: `${completionPercentage}%` }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {subtasksDone} of {totalSubtasks} subtasks completed
                            </p>
                        </div>
                    )}

                    {/* Users Who Worked on This Task */}
                    {usersWhoWorked.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                                <Users className="h-4 w-4" />
                                {t('tasks.teamActivity') || "Team Activity"}
                            </h3>

                            <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
                                {/* Leaderboard-style list */}
                                <div className="divide-y divide-border/50">
                                    {Array.from(timeByUser.values())
                                        .sort((a, b) => b.totalSeconds - a.totalSeconds)
                                        .map(({ user, totalSeconds }) => (
                                            <div key={user.id} className="flex justify-between items-center p-3 hover:bg-muted/30 transition-colors group">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary ring-2 ring-background group-hover:ring-muted transition-all">
                                                        {user.name?.substring(0, 2).toUpperCase() || "??"}
                                                    </div>
                                                    <span className="text-sm font-medium">{user.name || 'Unknown'}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 md:w-24 bg-muted/50 rounded-full h-1.5 overflow-hidden hidden sm:block">
                                                        <div
                                                            className="bg-primary h-full rounded-full"
                                                            style={{ width: `${Math.min(100, (totalSeconds / calculateTotalTimeValue()) * 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-semibold font-mono w-16 text-right">{formatTime(totalSeconds)}</span>
                                                </div>
                                            </div>
                                        ))}
                                </div>

                                {/* Total Time Hero Section */}
                                <div className="p-4 bg-muted/30 border-t border-border/50 flex items-center justify-between">
                                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        {t('tasks.totalTimeSpent') || "Total Time Spent"}
                                    </span>
                                    <span className="text-xl font-bold font-mono tracking-tight text-primary">
                                        {calculateTotalTime()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Subtasks Time Tracking */}
                    {totalSubtasks > 0 && (() => {
                        // Group time entries by subtask
                        const timeBySubtask = new Map<string, {
                            subtask: { id: string; title: string }
                            entries: Array<{
                                user: { id: string; name: string | null }
                                totalSeconds: number
                            }>
                            totalSeconds: number
                        }>()

                        timeEntries.forEach(entry => {
                            if (entry.endTime && entry.subtaskId && entry.subtask) {
                                const start = new Date(entry.startTime).getTime()
                                const end = new Date(entry.endTime).getTime()
                                const seconds = Math.floor((end - start) / 1000)

                                const existing = timeBySubtask.get(entry.subtaskId)
                                if (existing) {
                                    existing.totalSeconds += seconds
                                    const userEntry = existing.entries.find(e => e.user.id === entry.user.id)
                                    if (userEntry) {
                                        userEntry.totalSeconds += seconds
                                    } else {
                                        existing.entries.push({
                                            user: entry.user,
                                            totalSeconds: seconds
                                        })
                                    }
                                } else {
                                    timeBySubtask.set(entry.subtaskId, {
                                        subtask: entry.subtask,
                                        entries: [{
                                            user: entry.user,
                                            totalSeconds: seconds
                                        }],
                                        totalSeconds: seconds
                                    })
                                }
                            }
                        })

                        if (timeBySubtask.size === 0) return null

                        const sortedSubtasks = Array.from(timeBySubtask.values()).sort((a, b) => {
                            const aIndex = task.subtasks?.findIndex(s => s.id === a.subtask.id) ?? -1
                            const bIndex = task.subtasks?.findIndex(s => s.id === b.subtask.id) ?? -1
                            if (aIndex === -1) return 1
                            if (bIndex === -1) return -1
                            return aIndex - bIndex
                        })

                        return (
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                                    <CheckCircle2 className="h-4 w-4" />
                                    {t('tasks.subtaskBreakdown') || "Subtask Breakdown"}
                                </h3>
                                <div className="grid gap-2">
                                    {sortedSubtasks.map(({ subtask, entries, totalSeconds }) => (
                                        <div key={subtask.id} className="bg-card border border-border/40 rounded-lg shadow-sm overflow-hidden transition-all hover:border-border/80 hover:shadow-md">
                                            <button
                                                onClick={() => toggleSubtask(subtask.id)}
                                                className="w-full flex justify-between items-center p-3 hover:bg-muted/30 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-1 rounded-md transition-transform duration-200 ${expandedSubtasks[subtask.id] ? 'bg-primary/10 rotate-180' : 'bg-muted'}`}>
                                                        <ChevronDown className={`h-3.5 w-3.5 ${expandedSubtasks[subtask.id] ? 'text-primary' : 'text-muted-foreground'}`} />
                                                    </div>
                                                    <span className="text-sm font-medium">{subtask.title}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-muted-foreground hidden sm:inline-block">
                                                        {entries.length} {entries.length === 1 ? 'contributor' : 'contributors'}
                                                    </span>
                                                    <span className="text-sm font-semibold font-mono bg-muted/50 px-2 py-0.5 rounded text-foreground/80">
                                                        {formatTime(totalSeconds)}
                                                    </span>
                                                </div>
                                            </button>

                                            {expandedSubtasks[subtask.id] && (
                                                <div className="bg-muted/10 border-t border-border/50 px-2 py-2">
                                                    {entries
                                                        .sort((a, b) => b.totalSeconds - a.totalSeconds)
                                                        .map(({ user, totalSeconds: userSeconds }) => (
                                                            <div key={user.id} className="flex justify-between items-center px-3 py-1.5 rounded-md hover:bg-background/50 text-xs transition-colors">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                                                                        {user.name?.substring(0, 1).toUpperCase()}
                                                                    </div>
                                                                    <span className="text-muted-foreground">{user.name || 'Unknown'}</span>
                                                                </div>
                                                                <span className="font-medium font-mono text-muted-foreground/80">{formatTime(userSeconds)}</span>
                                                            </div>
                                                        ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })()}



                    {/* Time Entries History - Collapsible */}
                    {timeEntries.length > 0 && (
                        <div>
                            <Button
                                variant="ghost"
                                onClick={() => setShowTimeHistory(!showTimeHistory)}
                                className="w-full justify-between p-2 h-auto"
                            >
                                <span className="text-sm font-semibold">Time Entries History</span>
                                {showTimeHistory ? (
                                    <ChevronUp className="h-4 w-4" />
                                ) : (
                                    <ChevronDown className="h-4 w-4" />
                                )}
                            </Button>
                            {showTimeHistory && (
                                <div className="space-y-2 max-h-60 overflow-y-auto mt-2">
                                    {timeEntries
                                        .filter(entry => entry.endTime)
                                        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                                        .map(entry => {
                                            const start = new Date(entry.startTime)
                                            const end = new Date(entry.endTime!)
                                            const duration = Math.floor((end.getTime() - start.getTime()) / 1000)
                                            const hours = Math.floor(duration / 3600)
                                            const minutes = Math.floor((duration % 3600) / 60)
                                            const seconds = duration % 60
                                            const durationStr = hours > 0
                                                ? `${hours}h ${minutes}m`
                                                : minutes > 0
                                                    ? `${minutes}m ${seconds}s`
                                                    : `${seconds}s`

                                            return (
                                                <div key={entry.id} className="p-2 bg-muted/50 rounded text-sm">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="font-medium">{entry.user?.name || 'Unknown'}</p>
                                                            {entry.description && (
                                                                <p className="text-xs text-muted-foreground mt-1">{entry.description}</p>
                                                            )}
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                {format(start, 'dd/MM/yyyy HH:mm', { locale: dateLocale })} - {format(end, 'HH:mm', { locale: dateLocale })}
                                                            </p>
                                                        </div>
                                                        <span className="font-medium">{durationStr}</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
