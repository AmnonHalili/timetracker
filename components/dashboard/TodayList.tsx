"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState, useEffect, startTransition } from "react"
import { useRouter } from "next/navigation"

interface TimeEntry {
    id: string
    startTime: Date
    endTime: Date | null
    description?: string | null
    breaks?: { startTime: Date; endTime: Date | null }[]
}

interface TodayListProps {
    entries: TimeEntry[]
}

export function TodayList({ entries }: TodayListProps) {
    const router = useRouter()
    const [editingId, setEditingId] = useState<string | null>(null)
    const [tempDesc, setTempDesc] = useState("")

    // Local state for optimistic updates
    const [localEntries, setLocalEntries] = useState(entries)
    // Track IDs that are being deleted to prevent showing them during router.refresh()
    const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(new Set())

    // Sync local state when server props change
    useEffect(() => {
        // Filter out entries that are pending deletion to prevent them from reappearing
        // This is critical for fast deletions - entries stay filtered even after router.refresh()
        const filteredEntries = entries.filter(e => !pendingDeletions.has(e.id))

        // Only update if there are actual changes to avoid unnecessary re-renders
        setLocalEntries(prev => {
            const prevIds = new Set(prev.map(e => e.id))
            const newIds = new Set(filteredEntries.map(e => e.id))

            // Check if sets are different
            if (prevIds.size !== newIds.size ||
                !Array.from(prevIds).every(id => newIds.has(id)) ||
                !Array.from(newIds).every(id => prevIds.has(id))) {
                return filteredEntries
            }
            return prev
        })
    }, [entries, pendingDeletions])

    // Helper to calculate duration string
    const getDuration = (start: Date, end: Date | null, breaks?: Array<{ startTime: Date; endTime: Date | null }>) => {
        const now = new Date().getTime()
        const startTime = new Date(start).getTime()
        const endTime = end ? new Date(end).getTime() : now

        let totalBreakTime = 0
        if (breaks) {
            breaks.forEach(b => {
                const bStart = new Date(b.startTime).getTime()
                const bEnd = b.endTime ? new Date(b.endTime).getTime() : (end ? endTime : now)
                totalBreakTime += (bEnd - bStart)
            })
        }

        const diff = Math.max(0, endTime - startTime - totalBreakTime)

        if (!end && !breaks?.some(b => !b.endTime)) {
            // If active and not paused, maybe show "Active"? 
            // User requested "Total time less breaks", usually they want to see the running time.
            // Let's return the running timer value.
        }

        // Just format the diff
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

    const handleEditStart = (entry: TimeEntry) => {
        setEditingId(entry.id)
        setTempDesc(entry.description || "")
    }

    const handleEditSave = async (id: string) => {
        // Optimistic update
        setLocalEntries(current => current.map(e =>
            e.id === id ? { ...e, description: tempDesc } : e
        ))
        setEditingId(null) // Exit edit mode immediately

        try {
            await fetch("/api/time-entries", {
                method: "PATCH",
                body: JSON.stringify({ id, description: tempDesc }),
            })
            startTransition(() => {
                router.refresh()
            })
        } catch {
            console.error("Failed to save")
            // Revert on failure request? mostly overkill for this simple app but good practice
            // For now assuming success or user will refresh if it failed.
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: string) => {
        if (e.key === 'Enter') {
            e.preventDefault() // Prevent anything else
            handleEditSave(id)
        }
    }

    // Need to handle onBlur too, but ensure we don't save twice? 
    // Actually if we setEditingId(null) in handleEditSave, the input unmounts, so onBlur might not fire or won't matter?
    // Let's keep onBlur for clicking away.
    // To avoid race conditions, we can use the fact that setEditingId(null) removes the input.

    const handleDelete = (id: string) => {
        if (!confirm("Delete this entry?")) return

        // Optimistic update - remove entry immediately from UI (BEFORE any async operations)
        const deletedEntry = localEntries.find(e => e.id === id)
        const deletedIndex = localEntries.findIndex(e => e.id === id)

        if (!deletedEntry) return

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
                alert("Failed to delete entry. Please try again.")
            })
    }

    return (
        <div className="space-y-1">
            <h3 className="text-sm font-medium text-muted-foreground px-4 mb-4 mt-8">Today</h3>

            <div className="flex items-center px-4 pb-2 text-xs font-medium text-muted-foreground">
                <span>Description</span>
                <div className="ml-auto flex items-center gap-8">
                    <span className="w-[85px] text-center">Time</span>
                    <span className="w-[60px] text-center">Duration</span>
                    <span className="w-[40px]"></span>
                </div>
            </div>

            <div className="border-t border-b divide-y bg-background">
                {localEntries.length === 0 && (
                    <div className="p-4 text-sm text-muted-foreground text-center">No entries for today</div>
                )}
                {localEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center p-4 hover:bg-muted/10 transition-colors h-14">
                        {editingId === entry.id ? (
                            <Input
                                value={tempDesc}
                                onChange={(e) => setTempDesc(e.target.value)}
                                onBlur={() => handleEditSave(entry.id)}
                                onKeyDown={(e) => handleKeyDown(e, entry.id)}
                                autoFocus
                                className="h-8 w-full max-w-sm"
                            />
                        ) : (
                            <span
                                className="text-sm cursor-pointer hover:underline underline-offset-4 decoration-muted-foreground/50"
                                onClick={() => handleEditStart(entry)}
                            >
                                {entry.description || "Add description"}
                            </span>
                        )}

                        <div className="ml-auto flex items-center gap-8">
                            <span className="text-sm text-muted-foreground w-[85px] text-center">
                                {getTimeRange(entry.startTime, entry.endTime)}
                            </span>
                            <span className="font-mono text-sm w-[60px] text-center">
                                {getDuration(entry.startTime, entry.endTime, entry.breaks)}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-auto p-0 font-normal"
                                onClick={() => handleDelete(entry.id)}
                            >
                                Delete
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
