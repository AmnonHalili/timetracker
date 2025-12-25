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
import { useSession } from "next-auth/react"

interface CreateEventDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    defaultDate?: Date
    projectId?: string | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    event?: any // Simplified type for now, matching the flexibility needed
    mode?: 'create' | 'edit'
}

export function CreateEventDialog({ open, onOpenChange, defaultDate, projectId, event, mode = 'create' }: CreateEventDialogProps) {
    const router = useRouter()
    const { data: session } = useSession()
    const [loading, setLoading] = useState(false)

    // Form state
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [type, setType] = useState("MEETING")
    const [location, setLocation] = useState("")
    const [allDay, setAllDay] = useState(false)
    const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string | null }>>([])
    const [participantIds, setParticipantIds] = useState<string[]>([])

    // Date/Time state
    const formatDateLocal = (date: Date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    const [startDate, setStartDate] = useState(
        defaultDate ? formatDateLocal(defaultDate) : formatDateLocal(new Date())
    )
    const [startTime, setStartTime] = useState("06:00")
    const [endDate, setEndDate] = useState(
        defaultDate ? formatDateLocal(defaultDate) : formatDateLocal(new Date())
    )
    const [endTime, setEndTime] = useState("07:00")

    // Initialize/Reset form based on mode and open state
    useEffect(() => {
        if (open) {
            // Fetch users list
            fetch("/api/team?all=true")
                .then(res => res.json())
                .then(data => {
                    setUsers(data)
                })
                .catch(() => {
                    console.error("Failed to load users")
                    setUsers([])
                })

            if (mode === 'edit' && event) {
                setTitle(event.title)
                setDescription(event.description || "")
                setType(event.type)
                setLocation(event.location || "")
                setAllDay(event.allDay)

                // Populate participants
                if (event.participants) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    setParticipantIds(event.participants.map((p: any) => p.user.id))
                }

                const start = new Date(event.startTime)
                const end = new Date(event.endTime)

                setStartDate(formatDateLocal(start))
                setStartTime(start.toTimeString().slice(0, 5))
                setEndDate(formatDateLocal(end))
                setEndTime(end.toTimeString().slice(0, 5))
            } else {
                // Reset for create mode
                resetForm()
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                    participantIds,
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
        setParticipantIds([])

        const baseDate = defaultDate || new Date()
        const dateStr = formatDateLocal(baseDate)
        const hour = baseDate.getHours()
        const minutes = baseDate.getMinutes()

        // If defaultDate is provided AND has a specific time (not midnight), use that time
        // Otherwise default to 6-7 AM
        const hasSpecificTime = hour !== 0 || minutes !== 0
        const startHourStr = (defaultDate && hasSpecificTime) ? String(hour).padStart(2, '0') + ":00" : "06:00"
        const endHourStr = (defaultDate && hasSpecificTime) ? String((hour + 1) % 24).padStart(2, '0') + ":00" : "07:00"

        setStartDate(dateStr)
        setStartTime(startHourStr)
        setEndDate(dateStr)
        setEndTime(endHourStr)
    }

    const toggleUser = (userId: string) => {
        setParticipantIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        )
    }

    const toggleSelectAll = () => {
        if (participantIds.length === users.length) {
            setParticipantIds([])
        } else {
            setParticipantIds(users.map(u => u.id))
        }
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

                        {/* Participants */}
                        {users.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Participants</Label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                                        onClick={toggleSelectAll}
                                    >
                                        {participantIds.length === users.length ? 'Deselect All' : 'Select All'}
                                    </Button>
                                </div>
                                <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-2">
                                    {users.map(user => {
                                        const isCurrentUser = user.id === session?.user?.id
                                        return (
                                            <div key={user.id} className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    id={`user-${user.id}`}
                                                    checked={participantIds.includes(user.id)}
                                                    onChange={() => toggleUser(user.id)}
                                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                />
                                                <Label htmlFor={`user-${user.id}`} className="cursor-pointer text-sm font-normal flex items-center gap-1">
                                                    {user.name || user.email}
                                                    {isCurrentUser && <span className="text-xs text-muted-foreground">(You)</span>}
                                                </Label>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}


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
