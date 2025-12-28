"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format, isToday, isYesterday } from "date-fns"
import { Pencil, MoreVertical, Trash2 } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EditEntryDialog } from "./EditEntryDialog"
import { useLanguage } from "@/lib/useLanguage"

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

interface Task {
    id: string
    title: string
    subtasks?: Array<{ id: string; title: string; isDone: boolean }>
}

interface EntryHistoryProps {
    entries: TimeEntry[]
    tasks: Task[]
    optimisticEntryId?: string | null
    onOptimisticEntryCleared?: () => void
}

export function EntryHistory({ entries, tasks, optimisticEntryId, onOptimisticEntryCleared }: EntryHistoryProps) {
    const router = useRouter()
    const { t } = useLanguage()
    const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [localEntries, setLocalEntries] = useState(entries)
    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null)
    const [tempDescription, setTempDescription] = useState("")

    useEffect(() => {
        setLocalEntries(entries)
        
        // When server entries arrive, check if we should remove the optimistic entry
        if (optimisticEntryId && onOptimisticEntryCleared) {
            // Check if the optimistic entry (temp ID) is still in the list
            const hasOptimisticEntry = entries.some(e => e.id === optimisticEntryId)
            
            // If optimistic entry is gone, it means server data replaced it
            // Clear the callback to indicate we no longer need the optimistic entry
            if (!hasOptimisticEntry) {
                // Small delay to ensure smooth transition
                setTimeout(() => {
                    onOptimisticEntryCleared()
                }, 100)
            }
        }
    }, [entries, optimisticEntryId, onOptimisticEntryCleared])

    const handleEditStart = (entry: TimeEntry) => {
        setEditingEntry(entry)
        setEditDialogOpen(true)
    }

    const handleDialogSave = async (id: string, updates: { startTime?: Date; endTime?: Date; description?: string; taskIds?: string[] }) => {
        setLocalEntries(current => current.map(e =>
            e.id === id ? { ...e, ...updates } : e
        ))

        try {
            await fetch("/api/time-entries", {
                method: "PATCH",
                body: JSON.stringify({ id, ...updates }),
            })
            router.refresh()
        } catch (e) {
            console.error("Failed to save", e)
        }
    }

    const startInlineEdit = (entry: TimeEntry) => {
        setInlineEditingId(entry.id)
        setTempDescription(entry.description || "")
    }

    const saveInlineEdit = async () => {
        if (!inlineEditingId) return

        const id = inlineEditingId
        const description = tempDescription

        setInlineEditingId(null)
        setTempDescription("")

        // Optimistic update
        setLocalEntries(current => current.map(e =>
            e.id === id ? { ...e, description } : e
        ))

        try {
            await fetch("/api/time-entries", {
                method: "PATCH",
                body: JSON.stringify({ id, description }),
            })
            router.refresh()
        } catch (e) {
            console.error("Failed to save", e)
            // Revert on failure? For now just log
        }
    }

    const handleInlineKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            saveInlineEdit()
        } else if (e.key === "Escape") {
            setInlineEditingId(null)
            setTempDescription("")
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm(t('common.delete') + "?")) return
        await fetch(`/api/time-entries?id=${id}`, { method: "DELETE" })
        router.refresh()
    }

    // Helper to calculate duration string
    const getDuration = (start: Date, end: Date | null, breaks?: Array<{ startTime: Date; endTime: Date | null }>) => {
        const now = new Date().getTime()
        const startTime = new Date(start).getTime()
        const endTime = end ? new Date(end).getTime() : now

        let totalBreakTime = 0
        if (breaks) {
            breaks.forEach((b) => {
                const bStart = new Date(b.startTime).getTime()
                const bEnd = b.endTime ? new Date(b.endTime).getTime() : (end ? endTime : now)
                totalBreakTime += (bEnd - bStart)
            })
        }

        const diff = Math.max(0, endTime - startTime - totalBreakTime)

        const h = Math.floor(diff / 3600000)
        const m = Math.floor((diff % 3600000) / 60000)
        const s = Math.floor((diff % 60000) / 1000)
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    const getTimeRange = (start: Date, end: Date | null) => {
        const formatTime = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        if (!end) return `${formatTime(new Date(start))} - ...`
        return `${formatTime(new Date(start))} - ${formatTime(new Date(end))}`
    }

    // Group entries by date
    const groupedEntries = localEntries.reduce((groups, entry) => {
        const date = new Date(entry.startTime)
        let key = format(date, 'yyyy-MM-dd')

        if (isToday(date)) key = t('timeEntries.today')
        else if (isYesterday(date)) key = t('timeEntries.yesterday')
        else key = format(date, 'dd/MM/yyyy')

        if (!groups[key]) {
            groups[key] = []
        }
        groups[key].push(entry)
        return groups
    }, {} as Record<string, TimeEntry[]>)

    const groupsList = Object.entries(groupedEntries)

    return (
        <div className="space-y-8">
            {groupsList.map(([groupName, groupEntries]) => (
                <div key={groupName} className="space-y-4">
                    <h3 className="text-lg font-bold text-black px-1 sticky top-0 bg-background/95 backdrop-blur z-10 py-2 w-fit">
                        {groupName}
                    </h3>

                    <div className="space-y-4">
                        {groupEntries.map((entry) => (
                            <div key={entry.id} className="relative group">
                                {/* Entry Content */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card/50 hover:bg-card hover:shadow-sm transition-all focus-within:bg-card focus-within:shadow-sm focus-within:ring-1 focus-within:ring-primary/20">
                                    <div className="space-y-1 min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-sm font-medium text-foreground">
                                                {getTimeRange(entry.startTime, entry.endTime)}
                                            </span>

                                        </div>

                                        <div className="flex flex-col gap-1">
                                            {inlineEditingId === entry.id ? (
                                                <Input
                                                    value={tempDescription}
                                                    onChange={(e) => setTempDescription(e.target.value)}
                                                    onBlur={saveInlineEdit}
                                                    onKeyDown={handleInlineKeyDown}
                                                    autoFocus
                                                    className="h-7 text-sm px-1 -ml-1 border-transparent hover:border-input focus:border-input bg-transparent focus:bg-background"
                                                />
                                            ) : (
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div
                                                        className="text-sm text-muted-foreground truncate font-medium cursor-text hover:text-foreground transition-colors py-0.5"
                                                        onClick={() => startInlineEdit(entry)}
                                                        title="Click to edit"
                                                    >
                                                        {entry.description || t('timeEntries.noDescription')}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {entry.tasks && entry.tasks.length > 0 && (
                                                            <>
                                                                {entry.tasks.slice(0, 1).map((t, i) => (
                                                                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 truncate max-w-[150px]" title={t.title}>
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
                                                            // Try to find the subtask title from tasks array if not provided
                                                            const subtaskTitle = entry.subtask.title || (() => {
                                                                const task = tasks.find(t => t.subtasks?.some(st => st.id === entry.subtask?.id))
                                                                return task?.subtasks?.find(st => st.id === entry.subtask?.id)?.title || entry.subtask.id
                                                            })()
                                                            return (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-secondary/50 text-secondary-foreground border border-secondary/30 truncate max-w-[150px]" title={subtaskTitle}>
                                                                    {subtaskTitle}
                                                                </span>
                                                            )
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 shrink-0">
                                        <div className="text-right">
                                            <div className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Net Work</div>
                                            <div className="font-mono font-bold text-primary">
                                                {getDuration(entry.startTime, entry.endTime, entry.breaks)}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleEditStart(entry)}>
                                                        <Pencil className="mr-2 h-4 w-4" />
                                                        {t('common.edit')}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDelete(entry.id)} className="text-destructive focus:text-destructive">
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        {t('common.delete')}
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {localEntries.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                    You haven&apos;t added any time entries yet.
                </div>
            )}

            <EditEntryDialog
                entry={editingEntry}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                onSave={handleDialogSave}
                tasks={tasks}
            />
        </div>
    )
}
