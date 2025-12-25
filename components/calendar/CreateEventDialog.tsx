"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface CreateEventDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    defaultDate?: Date
    projectId?: string | null
}

export function CreateEventDialog({ open, onOpenChange, defaultDate, projectId }: CreateEventDialogProps) {
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

            const res = await fetch("/api/events", {
                method: "POST",
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
                    participantIds: [], // Can be extended later
                    reminderMinutes: [] // Can be extended later
                })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Failed to create event")
            }

            toast.success("Event created successfully")
            router.refresh()
            onOpenChange(false)

            // Reset form
            resetForm()
        } catch (error) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : "Failed to create event")
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setTitle("")
        setDescription("")
        setType("MEETING")
        setLocation("")
        setAllDay(false)
        const today = new Date().toISOString().split('T')[0]
        setStartDate(today)
        setStartTime("09:00")
        setEndDate(today)
        setEndTime("10:00")
    }

    // Update date/time when defaultDate changes
    useEffect(() => {
        if (defaultDate) {
            const dateStr = defaultDate.toISOString().split('T')[0]
            const hour = defaultDate.getHours()
            const nextHour = (hour + 1) % 24

            setStartDate(dateStr)
            setStartTime(`${String(hour).padStart(2, '0')}:00`)
            setEndDate(dateStr)
            setEndTime(`${String(nextHour).padStart(2, '0')}:00`)
        }
    }, [defaultDate])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Create New Event</DialogTitle>
                        <DialogDescription>
                            Add an event to your calendar
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
                            <Plus className="mr-2 h-4 w-4" />
                            Create Event
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
