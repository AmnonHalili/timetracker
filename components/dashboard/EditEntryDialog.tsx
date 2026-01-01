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
import { Loader2, Keyboard } from "lucide-react"
import { format } from "date-fns"

import { MultiSelect } from "@/components/ui/multi-select"
import { useLanguage } from "@/lib/useLanguage"

interface TimeEntry {
    id: string
    startTime: Date
    endTime: Date | null
    description?: string | null
    isManual?: boolean
    tasks?: { id: string; title: string }[]
}

interface Task {
    id: string
    title: string
}

interface EditEntryDialogProps {
    entry: TimeEntry | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSave: (id: string, updates: { startTime?: Date; endTime?: Date; description?: string; taskIds?: string[] }) => Promise<void>
    tasks?: Task[]
}

export function EditEntryDialog({ entry, open, onOpenChange, onSave, tasks = [] }: EditEntryDialogProps) {
    const { isRTL } = useLanguage()
    const [loading, setLoading] = useState(false)
    const [description, setDescription] = useState("")
    const [startDate, setStartDate] = useState("")
    const [startTime, setStartTime] = useState("")
    const [endDate, setEndDate] = useState("")
    const [endTime, setEndTime] = useState("")
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])

    useEffect(() => {
        if (entry) {
            setDescription(entry.description || "")
            const start = new Date(entry.startTime)
            setStartDate(format(start, "yyyy-MM-dd"))
            setStartTime(format(start, "HH:mm"))
            if (entry.endTime) {
                const end = new Date(entry.endTime)
                setEndDate(format(end, "yyyy-MM-dd"))
                setEndTime(format(end, "HH:mm"))
            } else {
                setEndDate("")
                setEndTime("")
            }
            // Only set task IDs if there are tasks, filter out any empty/invalid IDs
            const taskIds = entry.tasks?.map(t => t.id).filter(id => id && id.trim() !== '') || []
            setSelectedTaskIds(taskIds)
        }
    }, [entry])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!entry) return
        setLoading(true)

        try {
            const updates: { startTime?: Date; endTime?: Date; description: string; taskIds: string[] } = {
                description,
                taskIds: selectedTaskIds
            }

            // Combine date and time
            const newStart = new Date(`${startDate}T${startTime}`)
            const originalStart = new Date(entry.startTime).getTime()

            if (originalStart !== newStart.getTime()) {
                updates.startTime = newStart
            }

            if (endDate && endTime) {
                const newEnd = new Date(`${endDate}T${endTime}`)
                const originalEnd = entry.endTime ? new Date(entry.endTime).getTime() : 0

                if (originalEnd !== newEnd.getTime()) {
                    updates.endTime = newEnd
                }

                if (newEnd.getTime() <= newStart.getTime()) {
                    alert("End time must be after start time")
                    setLoading(false)
                    return
                }
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

    const taskOptions = tasks.map(t => ({ label: t.title, value: t.id }))

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
                            <Label className="text-right">Tasks</Label>
                            <div className="col-span-3">
                                <MultiSelect
                                    options={taskOptions}
                                    selected={selectedTaskIds}
                                    onChange={setSelectedTaskIds}
                                    placeholder="Select tasks..."
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="start" className="text-right">
                                Start
                            </Label>
                            <div className={`col-span-3 flex gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                                <Input
                                    id="start-date"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="flex-1"
                                    required
                                />
                                <Input
                                    id="start-time"
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-32"
                                    required
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="end" className="text-right">
                                End
                            </Label>
                            <div className={`col-span-3 flex gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                                <Input
                                    id="end-date"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="flex-1"
                                    disabled={!entry?.endTime}
                                />
                                <Input
                                    id="end-time"
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="w-32"
                                    disabled={!entry?.endTime}
                                />
                            </div>
                            {!entry?.endTime && <p className="col-start-2 col-span-3 text-[10px] text-muted-foreground mt-1">Use Stop button to end timer</p>}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {entry?.isManual && <Keyboard className="h-3 w-3 text-muted-foreground/70 mr-1" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
