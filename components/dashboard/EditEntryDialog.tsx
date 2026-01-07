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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import { Loader2, Keyboard } from "lucide-react"
import { format } from "date-fns"


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
    const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(undefined)

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
            setSelectedTaskId(taskIds.length > 0 ? taskIds[0] : undefined)
        }
    }, [entry, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!entry) return
        setLoading(true)

        try {
            const updates: { startTime?: Date; endTime?: Date; description: string; taskIds: string[] } = {
                description,
                taskIds: (selectedTaskId && selectedTaskId !== "no_task") ? [selectedTaskId] : []
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



    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-[425px] rounded-xl sm:w-full">
                <form onSubmit={handleSubmit}>
                    <DialogHeader className="text-left sm:text-center space-y-2 sm:space-y-1.5">
                        <DialogTitle className="text-xl sm:text-lg font-semibold">Edit Time Entry</DialogTitle>
                        <DialogDescription className="text-base sm:text-sm">
                            Make changes to the time entry. Modifying times will mark this entry as Manual.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-6 sm:gap-4 sm:py-4">
                        <div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
                            <Label htmlFor="description" className="text-left sm:text-right text-base sm:text-sm font-medium text-foreground/80 sm:text-foreground">
                                Description
                            </Label>
                            <Input
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="col-span-3 h-12 sm:h-10 text-base sm:text-sm"
                                placeholder="What are you working on?"
                            />
                        </div>

                        <div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
                            <Label className="text-left sm:text-right text-base sm:text-sm font-medium text-foreground/80 sm:text-foreground">Tasks</Label>
                            <div className="col-span-3">
                                <Select
                                    value={selectedTaskId}
                                    onValueChange={setSelectedTaskId}
                                >
                                    <SelectTrigger className="h-12 sm:h-auto min-h-12 sm:min-h-10 text-base sm:text-sm">
                                        <SelectValue placeholder="Select a task..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="no_task">No Task</SelectItem>
                                        {tasks.map((task) => (
                                            <SelectItem key={task.id} value={task.id}>
                                                {task.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
                            <Label htmlFor="start" className="text-left sm:text-right text-base sm:text-sm font-medium text-foreground/80 sm:text-foreground">
                                Start
                            </Label>
                            <div className={`col-span-3 flex gap-3 sm:gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                                <Input
                                    id="start-date"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="flex-1 h-12 sm:h-10 text-base sm:text-sm"
                                    required
                                />
                                <Input
                                    id="start-time"
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-32 h-12 sm:h-10 text-base sm:text-sm"
                                    required
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 sm:grid sm:grid-cols-4 sm:items-center sm:gap-4">
                            <Label htmlFor="end" className="text-left sm:text-right text-base sm:text-sm font-medium text-foreground/80 sm:text-foreground">
                                End
                            </Label>
                            <div className={`col-span-3 flex gap-3 sm:gap-2 ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
                                <Input
                                    id="end-date"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="flex-1 h-12 sm:h-10 text-base sm:text-sm"
                                    disabled={!entry?.endTime}
                                />
                                <Input
                                    id="end-time"
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="w-32 h-12 sm:h-10 text-base sm:text-sm"
                                    disabled={!entry?.endTime}
                                />
                            </div>
                            {!entry?.endTime && (
                                <p className="sm:col-start-2 col-span-3 text-[12px] sm:text-[10px] text-muted-foreground mt-1 sm:mt-0">
                                    Use Stop button to end timer
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading} size="lg" className="w-full sm:w-auto h-12 sm:h-10 text-base sm:text-sm font-medium">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {entry?.isManual && <Keyboard className="h-4 w-4 sm:h-3 sm:w-3 text-muted-foreground/70 mr-2 sm:mr-1" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
