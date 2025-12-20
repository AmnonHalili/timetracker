"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { format } from "date-fns"

interface TimeEntry {
    id: string
    startTime: Date
    endTime: Date | null
    description?: string | null
    isManual?: boolean
}

interface EditEntryDialogProps {
    entry: TimeEntry | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSave: (id: string, updates: { startTime?: Date; endTime?: Date; description?: string }) => Promise<void>
}

export function EditEntryDialog({ entry, open, onOpenChange, onSave }: EditEntryDialogProps) {
    const [loading, setLoading] = useState(false)
    const [description, setDescription] = useState("")
    const [start, setStart] = useState("")
    const [end, setEnd] = useState("")

    useEffect(() => {
        if (entry) {
            setDescription(entry.description || "")
            setStart(format(new Date(entry.startTime), "yyyy-MM-dd'T'HH:mm"))
            setEnd(entry.endTime ? format(new Date(entry.endTime), "yyyy-MM-dd'T'HH:mm") : "")
        }
    }, [entry])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!entry) return
        setLoading(true)

        try {
            const updates: any = { description }

            // Only update times if changed
            const originalStart = new Date(entry.startTime).getTime()
            const newStart = new Date(start).getTime()

            if (originalStart !== newStart) {
                updates.startTime = new Date(start)
            }

            if (end) {
                const originalEnd = entry.endTime ? new Date(entry.endTime).getTime() : 0
                const newEnd = new Date(end).getTime()

                if (originalEnd !== newEnd) {
                    updates.endTime = new Date(end)
                }

                if (newEnd <= newStart) {
                    alert("End time must be after start time")
                    setLoading(false)
                    return
                }
            } else if (entry.endTime) {
                // If end time was cleared (not supported for completed entries for now, usually editing implies modifying existing range)
                // Let's assume user cannot clear end time for a completed entry via this dialog
                // Or maybe they can? For now, ignore empty end if it was running.
            }

            await onSave(entry.id, updates)
            onOpenChange(false)
        } catch (error) {
            console.error(error)
            alert("Failed to update entry")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Edit Time Entry</DialogTitle>
                        <DialogDescription>
                            Make changes to the time entry. Modifying times will mark this entry as Manual.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="description" className="text-right">
                                Description
                            </Label>
                            <Input
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="start" className="text-right">
                                Start
                            </Label>
                            <Input
                                id="start"
                                type="datetime-local"
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="end" className="text-right">
                                End
                            </Label>
                            <Input
                                id="end"
                                type="datetime-local"
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                                className="col-span-3"
                                disabled={!entry?.endTime} // Disable end time edit if it's currently running (or allow closing it?)
                                // Let's allow editing end time only if it exists. If running, use the 'Stop' button in dashboard.
                                description={!entry?.endTime ? "Use Stop button to end timer" : undefined}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
