"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format, isToday, isYesterday } from "date-fns"
import { Keyboard, Pencil } from "lucide-react"
import { EditEntryDialog } from "./EditEntryDialog"

interface TimeEntry {
    id: string
    startTime: Date
    endTime: Date | null
    description?: string | null
    isManual?: boolean
    breaks?: { startTime: Date; endTime: Date | null }[]
}

interface EntryHistoryProps {
    entries: TimeEntry[]
}

export function EntryHistory({ entries }: EntryHistoryProps) {
    const router = useRouter()
    const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [localEntries, setLocalEntries] = useState(entries)

    useEffect(() => {
        setLocalEntries(entries)
    }, [entries])

    const handleEditStart = (entry: TimeEntry) => {
        setEditingEntry(entry)
        setEditDialogOpen(true)
    }

    const handleDialogSave = async (id: string, updates: { startTime?: Date; endTime?: Date; description?: string }) => {
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

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this entry?")) return
        await fetch(`/api/time-entries?id=${id}`, { method: "DELETE" })
        router.refresh()
    }

    // Helper to calculate duration string
    const getDuration = (start: Date, end: Date | null, breaks?: any[]) => {
        const now = new Date().getTime()
        const startTime = new Date(start).getTime()
        const endTime = end ? new Date(end).getTime() : now

        let totalBreakTime = 0
        if (breaks) {
            breaks.forEach((b: any) => {
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

        if (isToday(date)) key = 'Today'
        else if (isYesterday(date)) key = 'Yesterday'
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
                <div key={groupName} className="space-y-1">
                    <h3 className="text-sm font-medium text-muted-foreground px-4 mb-2">{groupName}</h3>

                    <div className="flex items-center px-4 pb-2 text-xs font-medium text-muted-foreground">
                        <span>Description</span>
                        <div className="ml-auto flex items-center gap-8">
                            <span className="w-[120px] text-center">Time</span>
                            <span className="w-[60px] text-center">Duration</span>
                            <span className="w-[40px]"></span>
                        </div>
                    </div>

                    <div className="border-t border-b divide-y bg-background">
                        {groupEntries.map((entry) => (
                            <div key={entry.id} className="flex items-center p-4 hover:bg-muted/10 transition-colors h-14 group">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 text-muted-foreground hover:text-primary flex items-center gap-2"
                                    onClick={() => handleEditStart(entry)}
                                >
                                    <div className="text-sm font-medium text-foreground">
                                        {entry.description || "Add description"}
                                    </div>
                                    <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Button>

                                <div className="ml-auto flex items-center gap-8">
                                    <span className="text-sm text-muted-foreground w-[120px] text-center whitespace-nowrap flex items-center justify-center gap-1">
                                        {entry.isManual && <Keyboard className="h-3 w-3 text-muted-foreground/70" title="Manual Entry" />}
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
            ))}

            {localEntries.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                    No time entries found.
                </div>
            )}

            <EditEntryDialog
                entry={editingEntry}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                onSave={handleDialogSave}
            />
        </div>
    )
}
