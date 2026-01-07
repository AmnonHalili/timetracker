"use client"

import { useState } from "react"
import { motion, useMotionValue, useTransform, useAnimation } from "framer-motion"
import { Play, Pause, Trash2, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { format, isPast, isToday } from "date-fns"
import { Input } from "@/components/ui/input"
import { Plus } from "lucide-react"

interface Task {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    assignees: Array<{ id: string; name: string | null }>;
    deadline: Date | string | null;
    startDate?: Date | string | null;
    checklist: Array<{ id: string; text: string; isDone: boolean }>;
}

interface SwipeableTaskCardProps {
    task: Task
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any
    isRTL?: boolean
    getPriorityColor: (priority: string) => string
    handleToggleTaskCompletion: (taskId: string, checked: boolean) => void
    handleStartWorking: (taskId: string) => void
    handleStopWorking: (taskId: string) => void
    handleEdit: (task: Task) => void
    handleDelete: (taskId: string) => void
    onClick: () => void
    isTimerRunning: boolean
    localSubtasks: Record<string, Array<{ id: string; title: string; isDone: boolean; priority?: string | null; assignedToId?: string | null; assignedTo?: { id: string; name: string | null; image?: string | null } | null; dueDate?: Date | string | null }>>

    setExpandedMobileTaskId: (id: string | null) => void
    handleToggleSubtask?: (taskId: string, subtaskId: string, currentDone: boolean) => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    formatDueDateIndicator?: (dueDate: Date | string | null, t: any) => { text: string; className: string } | null
    newSubtaskTitle?: Record<string, string>
    setNewSubtaskTitle?: (updater: (prev: Record<string, string>) => Record<string, string>) => void
    handleAddSubtask?: (taskId: string) => void
    isAdmin?: boolean
    currentUserId?: string
    visibleSubtasksMap?: Record<string, boolean>
    setVisibleSubtasksMap?: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void
    expandedSubtasks?: Record<string, boolean>
    setExpandedSubtasks?: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void
}

export function SwipeableTaskCard({
    task,
    t,
    getPriorityColor,
    handleToggleTaskCompletion,
    handleStartWorking,
    handleStopWorking,
    handleEdit,
    handleDelete,
    onClick,
    isTimerRunning,
    localSubtasks,

    setExpandedMobileTaskId,
    handleToggleSubtask,
    formatDueDateIndicator,
    newSubtaskTitle,
    setNewSubtaskTitle,
    handleAddSubtask,
    isAdmin,
    currentUserId,
    visibleSubtasksMap,
    setVisibleSubtasksMap,
    expandedSubtasks,
    setExpandedSubtasks
}: SwipeableTaskCardProps) {
    const x = useMotionValue(0)
    const controls = useAnimation()
    const [revealSide, setRevealSide] = useState<'left' | 'right' | null>(null)

    const LEFT_REVEAL_WIDTH = 80 // Width for single button (Start Working)
    const RIGHT_REVEAL_WIDTH = 160 // Width for two buttons (Edit and Delete)
    const SWIPE_THRESHOLD = 50 // Minimum swipe to trigger snap

    // Transform values for reveal animations
    const leftButtonsOpacity = useTransform(x, [0, LEFT_REVEAL_WIDTH], [0, 1])
    const rightButtonsOpacity = useTransform(x, [-RIGHT_REVEAL_WIDTH, 0], [1, 0])

    const closeActions = async () => {
        await controls.start({ x: 0 })
        setRevealSide(null)
    }

    const handleDragEnd = () => {
        const currentX = x.get()

        if (currentX > SWIPE_THRESHOLD) {
            // Snap to Right (Reveal Left actions)
            controls.start({ x: LEFT_REVEAL_WIDTH })
            setRevealSide('left')
        } else if (currentX < -SWIPE_THRESHOLD) {
            // Snap to Left (Reveal Right actions)
            controls.start({ x: -RIGHT_REVEAL_WIDTH })
            setRevealSide('right')
        } else {
            // Snap back
            closeActions()
        }
    }

    const isDone = task.status === 'DONE'

    return (
        <div className="relative overflow-hidden rounded-xl bg-muted/10 border shadow-sm">
            {/* Background Actions - LEFT SIDE (Swiping Right) */}
            <motion.div
                style={{ opacity: leftButtonsOpacity }}
                className="absolute inset-y-0 left-0 flex items-center h-full"
            >
                <div className="flex h-full w-20">
                    {/* Timer Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            if (isTimerRunning) handleStopWorking(task.id)
                            else handleStartWorking(task.id)
                            closeActions()
                        }}
                        className={cn(
                            "w-20 h-full flex flex-col items-center justify-center text-white gap-1 transition-colors px-2 text-center",
                            isTimerRunning ? "bg-orange-500 active:bg-orange-600" : "bg-blue-500 active:bg-blue-600"
                        )}
                    >
                        {isTimerRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                        <span className="text-[10px] font-bold uppercase tracking-wider leading-tight">
                            {isTimerRunning ? t('tasks.stopWorking') : t('tasks.startWorking')}
                        </span>
                    </button>
                </div>
            </motion.div>

            {/* Background Actions - RIGHT SIDE (Swiping Left) */}
            <motion.div
                style={{ opacity: rightButtonsOpacity }}
                className="absolute inset-y-0 right-0 flex items-center h-full"
            >
                <div className="flex h-full w-[160px]">
                    {/* Edit Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            handleEdit(task)
                            closeActions()
                        }}
                        className="w-20 h-full bg-slate-500 active:bg-slate-600 flex flex-col items-center justify-center text-white gap-1 transition-colors px-2 text-center"
                    >
                        <Pencil className="h-5 w-5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider leading-tight">
                            {t('common.edit')}
                        </span>
                    </button>

                    {/* Delete Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(task.id)
                            closeActions()
                        }}
                        className="w-20 h-full bg-red-500 active:bg-red-600 flex flex-col items-center justify-center text-white gap-1 transition-colors px-2 text-center"
                    >
                        <Trash2 className="h-5 w-5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider leading-tight">
                            {t('common.delete')}
                        </span>
                    </button>
                </div>
            </motion.div>

            {/* Foreground Task Card */}
            <motion.div
                drag="x"
                dragConstraints={{ left: -RIGHT_REVEAL_WIDTH, right: LEFT_REVEAL_WIDTH }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
                animate={controls}
                style={{ x }}
                onClick={() => {
                    if (revealSide) {
                        closeActions()
                    } else {
                        onClick()
                    }
                }}
                className={cn(
                    "relative bg-card p-4 touch-pan-y z-0",
                    isDone ? "opacity-60 bg-muted/20" : ""
                )}
            >
                <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
                        <Checkbox
                            checked={isDone}
                            onCheckedChange={(checked) => handleToggleTaskCompletion(task.id, checked as boolean)}
                            className="h-6 w-6 rounded-full border-2 border-primary/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                    </div>

                    <div className="flex-1 min-w-0">
                        {/* Header Row: Title, Priority & Assignees */}
                        <div className="flex justify-between items-start gap-2 mb-1.5">
                            <h3 className={cn(
                                "font-semibold text-base leading-none truncate pr-2 font-montserrat",
                                isDone && "line-through text-muted-foreground"
                            )}>
                                {task.title}
                            </h3>
                            <div className="flex items-center gap-2 shrink-0">
                                {/* Dates - Mobile only */}
                                <div className="flex items-center gap-1.5 md:hidden">
                                    {(() => {
                                        const hasStartDate = task.startDate
                                        const hasDeadline = task.deadline

                                        // If both dates exist and are in the same month, show as range
                                        if (hasStartDate && hasDeadline) {
                                            const start = new Date(task.startDate)
                                            const end = new Date(task.deadline)
                                            const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()

                                            if (sameMonth) {
                                                return (
                                                    <Badge variant="outline" className="text-[10px] h-5 px-2 font-medium bg-muted/50 text-muted-foreground border-0 rounded-full">
                                                        {format(start, 'd')}-{format(end, 'd MMM')}
                                                    </Badge>
                                                )
                                            } else {
                                                // Different months - show both
                                                return (
                                                    <>
                                                        <Badge variant="outline" className="text-[10px] h-5 px-2 font-medium bg-muted/50 text-muted-foreground border-0 rounded-full">
                                                            {format(start, 'd MMM')}
                                                        </Badge>
                                                        <Badge variant="outline" className="text-[10px] h-5 px-2 font-medium bg-muted/50 text-muted-foreground border-0 rounded-full">
                                                            {format(end, 'd MMM')}
                                                        </Badge>
                                                    </>
                                                )
                                            }
                                        } else if (hasStartDate) {
                                            return (
                                                <Badge variant="outline" className="text-[10px] h-5 px-2 font-medium bg-muted/50 text-muted-foreground border-0 rounded-full">
                                                    {format(new Date(task.startDate), 'd MMM')}
                                                </Badge>
                                            )
                                        } else if (hasDeadline) {
                                            return (
                                                <Badge variant="outline" className="text-[10px] h-5 px-2 font-medium bg-muted/50 text-muted-foreground border-0 rounded-full">
                                                    {format(new Date(task.deadline), 'd MMM')}
                                                </Badge>
                                            )
                                        }
                                        return null
                                    })()}
                                </div>

                                {/* Assignees */}
                                {task.assignees && task.assignees.length > 0 && (
                                    <div className="flex -space-x-2">
                                        {task.assignees.slice(0, 3).map((assignee) => (
                                            <Avatar key={assignee.id} className="h-6 w-6 border-2 border-background">
                                                <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                                                    {assignee.name?.[0]?.toUpperCase() || 'U'}
                                                </AvatarFallback>
                                            </Avatar>
                                        ))}
                                        {task.assignees.length > 3 && (
                                            <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[9px] font-medium text-muted-foreground">
                                                +{task.assignees.length - 3}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {task.priority !== 'LOW' && (
                                    <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 font-bold border-0", getPriorityColor(task.priority))}>
                                        {task.priority}
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Subtasks */}
                        {localSubtasks[task.id] && localSubtasks[task.id].length > 0 && (() => {
                            const subtasks = localSubtasks[task.id]
                            const isVisible = visibleSubtasksMap?.[task.id] ?? true
                            const isExpanded = expandedSubtasks?.[task.id] ?? false
                            const displaySubtasks = isExpanded ? subtasks : subtasks.slice(0, 3)
                            const hasMore = subtasks.length > 3

                            if (!isVisible) {
                                // Collapsed state - show toggle button
                                return (
                                    <div className="mb-2">
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setVisibleSubtasksMap?.(prev => ({ ...prev, [task.id]: true }))
                                            }}
                                            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-colors w-fit mb-2 cursor-pointer bg-muted/40 text-muted-foreground active:bg-muted"
                                        >
                                            <div className="h-1 w-1 rounded-full bg-muted-foreground/40"></div>
                                            {t('tasks.showSubtasks')?.replace('{count}', subtasks.length.toString()) || `Show ${subtasks.length} subtasks`}
                                        </div>
                                    </div>
                                )
                            }

                            return (
                                <div className="mb-2">
                                    {/* Subtasks Header - Toggle visibility */}
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setVisibleSubtasksMap?.(prev => ({ ...prev, [task.id]: !prev[task.id] }))
                                        }}
                                        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-colors w-fit mb-2 cursor-pointer bg-muted/40 text-muted-foreground active:bg-muted"
                                    >
                                        <div className={cn("w-1.5 h-1.5 rounded-full", isVisible ? 'bg-primary' : 'bg-muted-foreground/40')}></div>
                                        {isVisible
                                            ? (t('tasks.hideSubtasks')?.replace('{count}', subtasks.length.toString()) || `Hide ${subtasks.length} subtasks`)
                                            : (t('tasks.showSubtasks')?.replace('{count}', subtasks.length.toString()) || `Show ${subtasks.length} subtasks`)}
                                        <span className="text-muted-foreground/60">•</span>
                                        <span className="text-muted-foreground/60">
                                            {subtasks.filter((s) => s.isDone).length}/{subtasks.length} {t('tasks.done') || 'done'}
                                        </span>
                                    </div>

                                    {/* Subtasks List */}
                                    <div className="space-y-1.5">
                                        {displaySubtasks.map(subtask => (
                                            <div key={subtask.id} className="flex items-start gap-2.5 group" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={subtask.isDone}
                                                    onCheckedChange={() => handleToggleSubtask?.(task.id, subtask.id, subtask.isDone)}
                                                    className="h-4 w-4 mt-0.5 rounded-full data-[state=checked]:bg-primary/80 data-[state=checked]:border-primary/80"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <span className={cn(
                                                            "text-sm leading-tight break-words",
                                                            subtask.isDone && "line-through text-muted-foreground opacity-70"
                                                        )}>
                                                            {subtask.title}
                                                        </span>
                                                        {subtask.priority && subtask.priority !== 'LOW' && (
                                                            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0 mt-1.5",
                                                                subtask.priority === 'HIGH' ? "bg-red-500" :
                                                                    subtask.priority === 'MEDIUM' ? "bg-yellow-500" : "bg-muted"
                                                            )} />
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {subtask.assignedTo && (
                                                            <div className="flex items-center gap-1">
                                                                <Avatar className="h-3.5 w-3.5">
                                                                    <AvatarFallback className="text-[6px]">
                                                                        {subtask.assignedTo.name?.[0]?.toUpperCase() || 'U'}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">
                                                                    {subtask.assignedTo.name?.split(' ')[0]}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {subtask.dueDate && formatDueDateIndicator && (() => {
                                                            const indicator = formatDueDateIndicator(subtask.dueDate, t)
                                                            return (
                                                                <span className={cn(
                                                                    "text-[10px]",
                                                                    indicator?.className || "text-muted-foreground"
                                                                )}>
                                                                    {isToday(new Date(subtask.dueDate))
                                                                        ? t('calendar.today')
                                                                        : format(new Date(subtask.dueDate), "d MMM")}
                                                                </span>
                                                            )
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Show More Subtasks */}
                                        {hasMore && !isExpanded && (
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setExpandedSubtasks?.(prev => ({ ...prev, [task.id]: true }))
                                                }}
                                                className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors cursor-pointer text-muted-foreground hover:text-primary font-medium"
                                            >
                                                {t('tasks.showMoreSubtasks')?.replace('{count}', (subtasks.length - 3).toString()) || `Show ${subtasks.length - 3} more subtasks`}
                                            </div>
                                        )}
                                    </div>

                                    {/* Add Subtask Input - Only show when subtasks are visible */}
                                    {(isAdmin || (currentUserId && task.assignees.some(a => a.id === currentUserId))) && (
                                        <div className="flex items-center gap-1 mb-2 mt-2" onClick={(e) => e.stopPropagation()}>
                                            <Plus className="h-3 w-3 text-muted-foreground/60" />
                                            <Input
                                                placeholder={t('tasks.addSubtaskPlaceholder') || "Add subtask..."}
                                                value={newSubtaskTitle?.[task.id] || ""}
                                                onChange={(e) => setNewSubtaskTitle?.(prev => ({ ...prev, [task.id]: e.target.value }))}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && (newSubtaskTitle?.[task.id] || "").trim()) {
                                                        handleAddSubtask?.(task.id)
                                                        // Auto-expand subtasks after adding if more than 3
                                                        if (subtasks.length >= 3) {
                                                            setExpandedSubtasks?.(prev => ({ ...prev, [task.id]: true }))
                                                        }
                                                        // Auto-show subtasks if hidden
                                                        setVisibleSubtasksMap?.(prev => ({ ...prev, [task.id]: true }))
                                                    }
                                                }}
                                                className="h-6 text-xs border-none bg-transparent hover:bg-muted/30 focus-visible:ring-0 focus-visible:ring-offset-0 px-1"
                                            />
                                        </div>
                                    )}
                                </div>
                            )
                        })()}

                        {/* Add Subtask Input - Show when no subtasks exist yet */}
                        {(!localSubtasks[task.id] || localSubtasks[task.id].length === 0) && (isAdmin || (currentUserId && task.assignees.some(a => a.id === currentUserId))) && (
                            <div className="flex items-center gap-1 mb-2" onClick={(e) => e.stopPropagation()}>
                                <Plus className="h-3 w-3 text-muted-foreground/60" />
                                <Input
                                    placeholder={t('tasks.addSubtaskPlaceholder') || "Add subtask..."}
                                    value={newSubtaskTitle?.[task.id] || ""}
                                    onChange={(e) => setNewSubtaskTitle?.(prev => ({ ...prev, [task.id]: e.target.value }))}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && (newSubtaskTitle?.[task.id] || "").trim()) {
                                            handleAddSubtask?.(task.id)
                                            // Auto-expand subtasks after adding if more than 3
                                            if (localSubtasks[task.id] && localSubtasks[task.id].length >= 3) {
                                                setExpandedMobileTaskId(task.id)
                                            }
                                        }
                                    }}
                                    className="h-6 text-xs border-none bg-transparent hover:bg-muted/30 focus-visible:ring-0 focus-visible:ring-offset-0 px-1"
                                />
                            </div>
                        )}

                        {/* Description */}
                        {task.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                                {task.description}
                            </p>
                        )}

                        {/* Footer Row */}
                        <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-3">
                                {/* Deadline - Desktop only */}
                                {task.deadline && (() => {
                                    const date = new Date(task.deadline)
                                    const isOverdue = isPast(date) && !isToday(date)
                                    const isDueToday = isToday(date)

                                    return (
                                        <div className={cn(
                                            "hidden md:flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full",
                                            isOverdue ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400" :
                                                isDueToday ? "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400" :
                                                    "bg-muted text-muted-foreground"
                                        )}>
                                            <span className="font-medium">
                                                {isDueToday ? t('calendar.today') : format(date, "d MMM")}
                                            </span>
                                        </div>
                                    )
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
