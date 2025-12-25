"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Pencil } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface CreateEventDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    defaultDate?: Date
    projectId?: string | null
    event?: any // Simplified type for now, matching the flexibility needed
    mode?: 'create' | 'edit'
}

export function CreateEventDialog({ open, onOpenChange, defaultDate, projectId, event, mode = 'create' }: CreateEventDialogProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    // Form state
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [type, setType] = useState("MEETING")
    const [location, setLocation] = useState("")
    const [allDay, setAllDay] = useState(false)

    // Date/Time state
    const [startDate, setStartDate] = useState(
        defaultDate ? defaultDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    )
    const [startTime, setStartTime] = useState("09:00")
    const [endDate, setEndDate] = useState(
        defaultDate ? defaultDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    )
    const [endTime, setEndTime] = useState("10:00")

    // Initialize/Reset form based on mode and open state
    useEffect(() => {
        if (open) {
            if (mode === 'edit' && event) {
                setTitle(event.title)
                setDescription(event.description || "")
                setType(event.type)
                setLocation(event.location || "")
                setAllDay(event.allDay)

                const start = new Date(event.startTime)
                const end = new Date(event.endTime)

                setStartDate(start.toISOString().split('T')[0])
                setStartTime(start.toTimeString().slice(0, 5))
                setEndDate(end.toISOString().split('T')[0])
                setEndTime(end.toTimeString().slice(0, 5))
            } else {
                // Reset for create mode
                resetForm()
            }
        }
    }, [open, mode, event, defaultDate])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Combine date and time
            const startDateTime = allDay
                ? new Date(startDate).toISOString()
                : new Date(`${startDate}T${startTime}`).toISOString()

            const endDateTime = allDay
                ? new Date(endDate).toISOString()
                : new Date(`${endDate}T${endTime}`).toISOString()

            const url = mode === 'edit' ? `/api/events/${event.id}` : "/api/events"
            const method = mode === 'edit' ? "PATCH" : "POST"

            const res = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    description: description || null,
                    startTime: startDateTime,
                    endTime: endDateTime,
                    allDay,
                    type,
                    location: location || null,
                    projectId,
                    participantIds: [],
                    reminderMinutes: []
                })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || `Failed to ${mode} event`)
            }

            toast.success(`Event ${mode === 'edit' ? 'updated' : 'created'} successfully`)
            router.refresh()
            onOpenChange(false)
            resetForm()
        } catch (error) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : `Failed to ${mode} event`)
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        if (mode === 'edit') return // Don't reset if we are just switching back to edit mode logic handled in effect

        setTitle("")
        setDescription("")
        setType("MEETING")
        setLocation("")
        setAllDay(false)

        const baseDate = defaultDate || new Date()
        const dateStr = baseDate.toISOString().split('T')[0]
        const hour = baseDate.getHours()
        // If defaultDate is provided (e.g. clicking on a specific time slot), use that time
        // Otherwise default to next hour
        const startHourStr = defaultDate ? String(hour).padStart(2, '0') + ":00" : "09:00"
        const endHourStr = defaultDate ? String((hour + 1) % 24).padStart(2, '0') + ":00" : "10:00"

        setStartDate(dateStr)
        setStartTime(startHourStr)
        setEndDate(dateStr)
        setEndTime(endHourStr)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{mode === 'edit' ? 'Edit Event' : 'Create New Event'}</DialogTitle>
                        <DialogDescription>
                            {mode === 'edit' ? 'Update event details' : 'Add an event to your calendar'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Title */}
                        <div className="space-y-2">
                            <Label htmlFor="title">Title *</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Meeting with team"
                                required
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Add details about the event..."
                                rows={3}
                            />
                        </div>

                        {/* Type */}
                        <div className="space-y-2">
                            <Label htmlFor="type">Event Type</Label>
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger id="type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="MEETING">Meeting</SelectItem>
                                    <SelectItem value="APPOINTMENT">Appointment</SelectItem>
                                    <SelectItem value="TASK_TIME">Task Time</SelectItem>
                                    <SelectItem value="BREAK">Break</SelectItem>
                                    <SelectItem value="PERSONAL">Personal</SelectItem>
                                    <SelectItem value="OTHER">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* All Day Toggle */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="allDay"
                                checked={allDay}
                                onChange={(e) => setAllDay(e.target.checked)}
                                className="h-4 w-4"
                            />
                            <Label htmlFor="allDay" className="cursor-pointer">All day event</Label>
                        </div>

                        {/* Start Date/Time */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="startDate">Start Date *</Label>
                                <Input
                                    id="startDate"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    required
                                />
                            </div>
                            {!allDay && (
                                <div className="space-y-2">
                                    <Label htmlFor="startTime">Start Time</Label>
                                    <Input
                                        id="startTime"
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        {/* End Date/Time */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="endDate">End Date *</Label>
                                <Input
                                    id="endDate"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    required
                                />
                            </div>
                            {!allDay && (
                                <div className="space-y-2">
                                    <Label htmlFor="endTime">End Time</Label>
                                    <Input
                                        id="endTime"
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Location */}
                        <div className="space-y-2">
                            <Label htmlFor="location">Location</Label>
                            <Input
                                id="location"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="Office, Zoom link, etc."
                            />
                        </div>


                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {mode === 'edit' ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                            {mode === 'edit' ? 'Update Event' : 'Create Event'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
