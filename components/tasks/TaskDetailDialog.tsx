"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, Users, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"
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

    if (!task) return null

    // Calculate total time spent on this task
    const calculateTotalTime = () => {
        let totalSeconds = 0

        timeEntries.forEach(entry => {
            if (entry.endTime) {
                const start = new Date(entry.startTime).getTime()
                const end = new Date(entry.endTime).getTime()
                totalSeconds += Math.floor((end - start) / 1000)
            }
        })

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

                    {/* Task Info */}
                    {task.deadline && (
                        <div>
                            <h3 className="text-sm font-semibold mb-2">{t('tasks.deadline')}</h3>
                            <div className="flex items-center gap-2 text-sm">
                                <Calendar className="h-4 w-4" />
                                {format(new Date(task.deadline), 'dd/MM/yyyy', { locale: dateLocale })}
                            </div>
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
                                    // Find or add user entry
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

                        // Sort subtasks by their original order in the task
                        const sortedSubtasks = Array.from(timeBySubtask.values()).sort((a, b) => {
                            const aIndex = task.subtasks?.findIndex(s => s.id === a.subtask.id) ?? -1
                            const bIndex = task.subtasks?.findIndex(s => s.id === b.subtask.id) ?? -1
                            // If not found in original list, put at the end
                            if (aIndex === -1) return 1
                            if (bIndex === -1) return -1
                            return aIndex - bIndex
                        })

                        return (
                            <div>
                                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    {t('tasks.timeSpentOnSubtasks')}
                                </h3>
                                <div className="space-y-3">
                                    {sortedSubtasks.map(({ subtask, entries, totalSeconds }) => (
                                        <div key={subtask.id} className="p-3 bg-muted/50 rounded-lg">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm font-medium">{subtask.title}</span>
                                                <span className="text-sm font-semibold">{formatTime(totalSeconds)}</span>
                                            </div>
                                            <div className="space-y-1.5 mt-2 pl-2 border-l-2 border-muted">
                                                {entries
                                                    .sort((a, b) => b.totalSeconds - a.totalSeconds)
                                                    .map(({ user, totalSeconds: userSeconds }) => (
                                                        <div key={user.id} className="flex justify-between items-center text-xs">
                                                            <span className="text-muted-foreground">{user.name || 'Unknown'}</span>
                                                            <span className="font-medium">{formatTime(userSeconds)}</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })()}

                    {/* Users Who Worked on This Task - Combined with Time by User */}
                    {usersWhoWorked.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Users Who Worked on This Task
                            </h3>
                            <div className="space-y-2">
                                {Array.from(timeByUser.values())
                                    .sort((a, b) => b.totalSeconds - a.totalSeconds) // Sort by time descending
                                    .map(({ user, totalSeconds }) => (
                                        <div key={user.id} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                                            <span className="text-sm">{user.name || 'Unknown'}</span>
                                            <span className="text-sm font-medium">{formatTime(totalSeconds)}</span>
                                        </div>
                                    ))}
                            </div>
                            {/* Total Time Spent - Under the users list */}
                            <div className="mt-3 pt-3 border-t">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        Total Time Spent
                                    </span>
                                    <span className="text-lg font-medium">{calculateTotalTime()}</span>
                                </div>
                            </div>
                        </div>
                    )}



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
