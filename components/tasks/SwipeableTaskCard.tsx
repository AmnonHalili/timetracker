"use client"

import { useState } from "react"
import { motion, useMotionValue, useTransform, useAnimation } from "framer-motion"
import { Play, Pause, Trash2, Pencil, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { format, isPast, isToday } from "date-fns"

interface Task {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    assignees: Array<{ id: string; name: string | null }>;
    deadline: Date | string | null;
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
    localSubtasks: Record<string, Array<{ id: string; title: string; isDone: boolean; priority?: string | null; assignedToId?: string | null; dueDate?: Date | string | null }>>
    expandedMobileTaskId: string | null
    setExpandedMobileTaskId: (id: string | null) => void
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
    expandedMobileTaskId,
    setExpandedMobileTaskId
}: SwipeableTaskCardProps) {
    const x = useMotionValue(0)
    const controls = useAnimation()
    const [revealSide, setRevealSide] = useState<'left' | 'right' | null>(null)

    const REVEAL_WIDTH = 160 // Total width for two buttons
    const SWIPE_THRESHOLD = 50 // Minimum swipe to trigger snap

    // Transform values for reveal animations
    const leftButtonsOpacity = useTransform(x, [0, 100], [0, 1])
    const rightButtonsOpacity = useTransform(x, [-100, 0], [1, 0])

    const closeActions = async () => {
        await controls.start({ x: 0 })
        setRevealSide(null)
    }

    const handleDragEnd = () => {
        const currentX = x.get()

        if (currentX > SWIPE_THRESHOLD) {
            // Snap to Right (Reveal Left actions)
            controls.start({ x: REVEAL_WIDTH })
            setRevealSide('left')
        } else if (currentX < -SWIPE_THRESHOLD) {
            // Snap to Left (Reveal Right actions)
            controls.start({ x: -REVEAL_WIDTH })
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
                <div className="flex h-full">
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

                    {/* Done Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            handleToggleTaskCompletion(task.id, !isDone)
                            closeActions()
                        }}
                        className="w-20 h-full bg-green-500 active:bg-green-600 flex flex-col items-center justify-center text-white gap-1 transition-colors px-2 text-center"
                    >
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="text-[10px] font-bold uppercase tracking-wider leading-tight">
                            {isDone ? t('tasks.undo') : t('tasks.statusDone')}
                        </span>
                    </button>
                </div>
            </motion.div>

            {/* Background Actions - RIGHT SIDE (Swiping Left) */}
            <motion.div
                style={{ opacity: rightButtonsOpacity }}
                className="absolute inset-y-0 right-0 flex items-center h-full"
            >
                <div className="flex h-full">
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
                dragConstraints={{ left: -REVEAL_WIDTH, right: REVEAL_WIDTH }}
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
                    "relative bg-card p-4 touch-pan-y z-10",
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
                        {/* Header Row: Title & Priority */}
                        <div className="flex justify-between items-start gap-2">
                            <h3 className={cn(
                                "font-semibold text-base leading-none mb-1.5 truncate pr-2 font-montserrat",
                                isDone && "line-through text-muted-foreground"
                            )}>
                                {task.title}
                            </h3>
                            {task.priority !== 'LOW' && (
                                <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 font-bold border-0", getPriorityColor(task.priority))}>
                                    {task.priority}
                                </Badge>
                            )}
                        </div>

                        {/* Description */}
                        {task.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                                {task.description}
                            </p>
                        )}

                        {/* Footer Row */}
                        <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-3">
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

                                {/* Deadline */}
                                {task.deadline && (() => {
                                    const date = new Date(task.deadline)
                                    const isOverdue = isPast(date) && !isToday(date)
                                    const isDueToday = isToday(date)

                                    return (
                                        <div className={cn(
                                            "flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full",
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

                            {/* Subtasks Count */}
                            {localSubtasks[task.id] && localSubtasks[task.id].length > 0 && (
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setExpandedMobileTaskId(expandedMobileTaskId === task.id ? null : task.id)
                                    }}
                                    className={cn(
                                        "flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-colors",
                                        expandedMobileTaskId === task.id
                                            ? "bg-primary/10 text-primary border border-primary/20"
                                            : "bg-muted/40 text-muted-foreground active:bg-muted"
                                    )}
                                >
                                    <div className="h-1 w-1 rounded-full bg-current opacity-40" />
                                    {localSubtasks[task.id].filter((s) => s.isDone).length}/{localSubtasks[task.id].length}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
