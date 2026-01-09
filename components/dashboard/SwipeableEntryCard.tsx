"use client"

import { useState } from "react"
import { motion, useMotionValue, useTransform, useAnimation } from "framer-motion"
import { Pencil, Trash2, MoreVertical } from "lucide-react"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useMediaQuery } from "@/hooks/use-media-query"

interface TimeEntry {
    id: string
    startTime: Date
    endTime: Date | null
    description?: string | null
    isManual?: boolean
    breaks?: { startTime: Date; endTime: Date | null }[]
    tasks?: { id: string; title: string }[]
    subtask?: { id: string; title: string } | null
}

interface SwipeableEntryCardProps {
    entry: TimeEntry
    tasks: Array<{ id: string; title: string; subtasks?: Array<{ id: string; title: string; isDone: boolean }> }>
    isRTL: boolean
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: (key: any) => string
    onEdit: (entry: TimeEntry) => void
    onDelete: (entryId: string) => void
    inlineEditingId: string | null
    tempDescription: string
    onStartInlineEdit: (entry: TimeEntry) => void
    onSaveInlineEdit: () => void
    onTempDescriptionChange: (value: string) => void
    onInlineKeyDown: (e: React.KeyboardEvent) => void
    getTimeRange: (start: Date, end: Date | null) => string
    getDuration: (start: Date, end: Date | null, breaks?: Array<{ startTime: Date; endTime: Date | null }>) => string
}

export function SwipeableEntryCard({
    entry,
    tasks,
    isRTL,
    t,
    onEdit,
    onDelete,
    inlineEditingId,
    tempDescription,
    onStartInlineEdit,
    onSaveInlineEdit,
    onTempDescriptionChange,
    onInlineKeyDown,
    getTimeRange,
    getDuration
}: SwipeableEntryCardProps) {
    const isDesktop = useMediaQuery("(min-width: 768px)")
    const x = useMotionValue(0)
    const controls = useAnimation()
    const [revealSide, setRevealSide] = useState<'left' | 'right' | null>(null)

    const REVEAL_WIDTH = 160 // Total width for two buttons
    const SWIPE_THRESHOLD = 50 // Minimum swipe to trigger snap

    // Transform values for reveal animations
    const rightButtonsOpacity = useTransform(x, [-REVEAL_WIDTH, 0], [1, 0])

    const closeActions = async () => {
        await controls.start({ x: 0 })
        setRevealSide(null)
    }

    const handleDragEnd = () => {
        const currentX = x.get()

        if (currentX < -SWIPE_THRESHOLD) {
            // Snap to Left (Reveal Right actions)
            controls.start({ x: -REVEAL_WIDTH })
            setRevealSide('right')
        } else {
            // Snap back
            closeActions()
        }
    }

    return (
        <div className="relative overflow-hidden rounded-xl bg-muted/10 border shadow-sm">
            {/* Background Actions - RIGHT SIDE (Swiping Left) - Mobile Only */}
            {!isDesktop && (
                <motion.div
                    style={{ opacity: rightButtonsOpacity }}
                    className="absolute inset-y-0 right-0 flex items-center h-full"
                >
                    <div className="flex h-full w-[160px]">
                        {/* Edit Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onEdit(entry)
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
                                onDelete(entry.id)
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
            )}

            {/* Foreground Entry Card */}
            <motion.div
                drag={isDesktop ? false : "x"}
                dragConstraints={{ left: -REVEAL_WIDTH, right: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
                animate={controls}
                style={{ x }}
                onClick={() => {
                    if (revealSide) {
                        closeActions()
                    }
                }}
                className="relative bg-card p-3 md:p-4 touch-pan-y z-10"
            >
                <div className="flex flex-row items-center gap-4">
                    {/* Content wrapper */}
                    <div className="flex flex-col gap-3 flex-1 min-w-0">
                        {/* Time Range */}
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium text-foreground">
                                {getTimeRange(entry.startTime, entry.endTime)}
                            </span>
                        </div>

                        {/* Description */}
                        <div className="flex flex-col gap-1">
                            {inlineEditingId === entry.id ? (
                                <Input
                                    value={tempDescription}
                                    onChange={(e) => onTempDescriptionChange(e.target.value)}
                                    onBlur={onSaveInlineEdit}
                                    onKeyDown={onInlineKeyDown}
                                    autoFocus
                                    className="h-7 text-sm px-1 -ml-1 border-transparent hover:border-input focus:border-input bg-transparent focus:bg-background"
                                />
                            ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                    <div
                                        className="text-sm text-muted-foreground truncate font-medium cursor-text hover:text-foreground transition-colors py-0.5"
                                        onClick={() => onStartInlineEdit(entry)}
                                        title="Click to edit"
                                    >
                                        {entry.description || t('timeEntries.noDescription')}
                                    </div>
                                    <div className="flex flex-wrap gap-1 min-w-0 flex-1">
                                        {entry.tasks && entry.tasks.length > 0 && (
                                            <>
                                                {entry.tasks.slice(0, 1).map((t, i) => (
                                                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 truncate max-w-[400px]" title={t.title}>
                                                        {t.title}
                                                    </span>
                                                ))}
                                                {entry.tasks.length > 1 && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border" title={entry.tasks.slice(1).map(t => t.title).join(', ')}>
                                                        +{entry.tasks.length - 1} more
                                                    </span>
                                                )}
                                            </>
                                        )}
                                        {entry.subtask && (() => {
                                            const task = tasks.find(t => t.subtasks?.some(st => st.id === entry.subtask?.id))
                                            const subtaskTitle = task?.subtasks?.find(st => st.id === entry.subtask?.id)?.title || entry.subtask.id
                                            return (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-secondary/50 text-primary border border-secondary/30 truncate max-w-[150px]" title={subtaskTitle}>
                                                    {subtaskTitle}
                                                </span>
                                            )
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Net Work - centered vertically */}
                    <div className={`flex items-center shrink-0 gap-3 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`${isRTL ? 'text-left' : 'text-right'}`}>
                            <div className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">{t('timeEntries.netWork')}</div>
                            <div className="font-mono font-bold text-primary">
                                {getDuration(entry.startTime, entry.endTime, entry.breaks)}
                            </div>
                        </div>
                        
                        {/* Desktop: Three Dots Menu */}
                        {isDesktop && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-1.5 hover:bg-muted rounded-md transition-colors"
                                        aria-label="More options"
                                    >
                                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align={isRTL ? "start" : "end"}>
                                    <DropdownMenuItem
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onEdit(entry)
                                        }}
                                    >
                                        <Pencil className="h-4 w-4 me-2" />
                                        {t('common.edit')}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onDelete(entry.id)
                                        }}
                                        className="text-destructive focus:text-destructive"
                                    >
                                        <Trash2 className="h-4 w-4 me-2" />
                                        {t('common.delete')}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    )
}

