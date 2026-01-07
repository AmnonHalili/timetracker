"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { useState, useEffect, startTransition } from "react"
import { useRouter } from "next/navigation"
import { format, isToday, isYesterday } from "date-fns"
import { Pencil, Trash2 } from "lucide-react"
import { motion, useMotionValue, useTransform, useAnimation } from "framer-motion"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { EditEntryDialog } from "./EditEntryDialog"
import { useLanguage } from "@/lib/useLanguage"
import { toast } from "sonner"
import { SwipeableEntryCard } from "./SwipeableEntryCard"

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
    const { t, isRTL } = useLanguage()
    const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [localEntries, setLocalEntries] = useState(entries)
    const [inlineEditingId, setInlineEditingId] = useState<string | null>(null)
    const [tempDescription, setTempDescription] = useState("")
    // Track IDs that are being deleted to prevent showing them during router.refresh()
    const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set())
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [entryToDelete, setEntryToDelete] = useState<string | null>(null)

    useEffect(() => {
        // Filter out entries that are pending deletion to prevent them from reappearing
        // This is critical for fast deletions - entries stay filtered even after router.refresh()
        const filteredEntries = entries.filter(e => !pendingDeletions.has(e.id))
        
        // Always update local entries when entries prop changes
        // This ensures merged entries with updated breaks are reflected immediately
        // We update whenever the entries array changes, which includes when entry data (breaks, times) changes
        setLocalEntries(filteredEntries)
        
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
    }, [entries, optimisticEntryId, onOptimisticEntryCleared, pendingDeletions])

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
            startTransition(() => {
            router.refresh()
            })
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
            startTransition(() => {
            router.refresh()
            })
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

    const handleDelete = (id: string) => {
        setEntryToDelete(id)
        setDeleteDialogOpen(true)
    }

    const confirmDelete = () => {
        if (!entryToDelete) return

        const id = entryToDelete
        setDeleteDialogOpen(false)
        
        // Optimistic update - remove entry immediately from UI (BEFORE any async operations)
        const deletedEntry = localEntries.find(e => e.id === id)
        const deletedIndex = localEntries.findIndex(e => e.id === id)
        
        if (!deletedEntry) {
            setEntryToDelete(null)
            return
        }
        
        // Mark as pending deletion to prevent it from reappearing during router.refresh()
        setPendingDeletions(prev => new Set(prev).add(id))
        
        // Remove immediately for instant UI feedback - this happens synchronously
        setLocalEntries(current => current.filter(e => e.id !== id))
        
        // API call happens in background - doesn't block UI
        fetch(`/api/time-entries?id=${id}`, { method: "DELETE" })
            .then(() => {
                // Refresh in background after deletion completes
                startTransition(() => {
                    router.refresh()
                })
                // Keep in pending deletions longer to handle multiple rapid deletions
                // Remove after a longer delay to ensure all router.refresh() calls complete
                setTimeout(() => {
                    setPendingDeletions(prev => {
                        const next = new Set(prev)
                        next.delete(id)
                        return next
                    })
                }, 5000) // Longer delay to handle rapid deletions and ensure router.refresh() completes
                setEntryToDelete(null)
            })
            .catch(error => {
                // Revert on error - restore the entry at its original position
                setPendingDeletions(prev => {
                    const next = new Set(prev)
                    next.delete(id)
                    return next
                })
                setLocalEntries(current => {
                    const newEntries = [...current]
                    // Restore at original position if possible, otherwise append
                    if (deletedIndex >= 0 && deletedIndex <= newEntries.length) {
                        newEntries.splice(deletedIndex, 0, deletedEntry)
                    } else {
                        newEntries.push(deletedEntry)
                    }
                    return newEntries
                })
                console.error("Failed to delete entry:", error)
                toast.error(t('common.error') || "Failed to delete entry. Please try again.")
                setEntryToDelete(null)
            })
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
        let sortKey = format(date, 'yyyy-MM-dd') // Keep original date for sorting

        if (isToday(date)) {
            key = t('timeEntries.today')
            sortKey = '0000-00-00' // Today comes first
        } else if (isYesterday(date)) {
            key = t('timeEntries.yesterday')
            sortKey = '0000-00-01' // Yesterday comes second
        } else {
            key = format(date, 'dd/MM/yyyy')
            sortKey = format(date, 'yyyy-MM-dd') // Use date for sorting
        }

        if (!groups[key]) {
            groups[key] = { entries: [], sortKey }
        }
        groups[key].entries.push(entry)
        return groups
    }, {} as Record<string, { entries: TimeEntry[], sortKey: string }>)

    // Sort groups: Today first, Yesterday second, then by date (newest first)
    const groupsList = Object.entries(groupedEntries)
        .sort(([, a], [, b]) => {
            // Today always comes first
            if (a.sortKey === '0000-00-00') return -1
            if (b.sortKey === '0000-00-00') return 1
            // Yesterday comes second
            if (a.sortKey === '0000-00-01') return -1
            if (b.sortKey === '0000-00-01') return 1
            // For other dates, sort by date descending (newest first)
            if (a.sortKey > b.sortKey) return -1
            if (a.sortKey < b.sortKey) return 1
            return 0
        })
        .map(([key, value]) => [key, value.entries] as [string, TimeEntry[]])

    return (
        <div className="space-y-3 md:space-y-8">
            {groupsList.map(([groupName, groupEntries]) => (
                <div key={groupName} className="space-y-2 md:space-y-4">
                    <h3 className="text-base md:text-lg font-bold text-black px-2 md:px-1 sticky top-0 bg-background/95 backdrop-blur z-10 py-1 md:py-2 w-fit">
                        {groupName}
                    </h3>

                    <div className="space-y-4 md:space-y-4">
                        {groupEntries.map((entry) => (
                            <SwipeableEntryCard
                                key={entry.id}
                                entry={entry}
                                tasks={tasks}
                                isRTL={isRTL}
                                t={t}
                                onEdit={handleEditStart}
                                onDelete={handleDelete}
                                inlineEditingId={inlineEditingId}
                                tempDescription={tempDescription}
                                onStartInlineEdit={startInlineEdit}
                                onSaveInlineEdit={saveInlineEdit}
                                onTempDescriptionChange={setTempDescription}
                                onInlineKeyDown={handleInlineKeyDown}
                                getTimeRange={getTimeRange}
                                getDuration={getDuration}
                            />
                        ))}
                    </div>
                </div>
            ))}

            {localEntries.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                    {t('timeEntries.noEntries')}
                </div>
            )}

            <EditEntryDialog
                entry={editingEntry}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                onSave={handleDialogSave}
                tasks={tasks}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('common.delete')}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('timeEntries.deleteConfirm') || 'Are you sure you want to delete this time entry? This action cannot be undone.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setEntryToDelete(null)}>
                            {t('common.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            {t('common.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
