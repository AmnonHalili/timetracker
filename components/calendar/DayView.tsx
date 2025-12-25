import { Button } from "@/components/ui/button"
import { format, eachHourOfInterval, isSameHour, isSameDay } from "date-fns"
import { EventCard } from "./EventCard"
import { CreateEventDialog } from "./CreateEventDialog"
import { cn } from "@/lib/utils"
import { Plus } from "lucide-react"
import { useState } from "react"

interface DayViewProps {
    date: Date
    events: Array<{
        id: string
        title: string
        description?: string | null
        startTime: Date | string
        endTime: Date | string
        allDay: boolean
        type: string
        location?: string | null
        createdBy?: {
            name: string
            email: string
        }
        participants?: Array<{
            user: { name: string; email: string }
        }>
    }>
    tasks: Array<{
        id: string
        title: string
        deadline: Date | string | null
        priority: string
        status: string
        description: string | null
        assignees: Array<{ name: string; email: string }>
    }>
    projectId?: string | null
    onBack?: () => void
}

export function DayView({ date, events, tasks, projectId }: DayViewProps) {
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [selectedHour, setSelectedHour] = useState<Date | undefined>()

    // Generate hours from 6 AM to 11 PM
    const dayStart = new Date(date)
    dayStart.setHours(6, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 0, 0, 0)

    const hours = eachHourOfInterval({ start: dayStart, end: dayEnd })

    // Process tasks into event-like objects
    const taskEvents = tasks
        .filter(t => t.deadline && isSameDay(new Date(t.deadline), date) && t.status !== 'DONE')
        .map(t => {
            const deadline = new Date(t.deadline!)
            // Detect "Date Only" (stored as UTC Midnight)
            // If the time is exactly 00:00:00.000Z, we treat it as All Day (User likely picked just a date)
            const isUtcMidnight = deadline.getUTCHours() === 0 && deadline.getUTCMinutes() === 0 && deadline.getUTCSeconds() === 0

            // For timed tasks, assume 1 hour duration
            const endTime = new Date(deadline)
            endTime.setHours(endTime.getHours() + 1)

            return {
                id: t.id,
                title: t.title,
                description: t.description || `Status: ${t.status} | Priority: ${t.priority}`,
                startTime: deadline,
                endTime: endTime,
                allDay: isUtcMidnight, // Use UTC check to catch date-only inputs
                type: "TASK_TIME",
                location: null,
                createdBy: { name: "System", email: "" },
                participants: t.assignees.map(a => ({ user: a }))
            }
        })

    // Filter events to only those on this specific day
    const dayEvents = [
        ...events.filter(e => isSameDay(new Date(e.startTime), date)),
        ...taskEvents
    ]

    // Sort events by start time
    const sortedEvents = [...dayEvents].sort((a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )

    // Group events by hour for the timeline
    const eventsByHour = new Map<number, typeof sortedEvents>()
    sortedEvents.forEach(event => {
        // Skip all-day events in timeline
        if (event.allDay) return

        const eventStart = new Date(event.startTime)
        const hour = eventStart.getHours()
        if (!eventsByHour.has(hour)) {
            eventsByHour.set(hour, [])
        }
        eventsByHour.get(hour)?.push(event)
    })

    // All-day events (filtered for this day)
    const allDayEvents = dayEvents
        .filter(e => e.allDay)
        .sort((a, b) => {
            if (a.type === 'TASK_TIME' && b.type !== 'TASK_TIME') return -1
            if (a.type !== 'TASK_TIME' && b.type === 'TASK_TIME') return 1
            return 0
        })

    const handleHourClick = (hour: Date) => {
        setSelectedHour(hour)
        setCreateDialogOpen(true)
    }

    return (
        <div className="space-y-4">
            {/* Header - Buttons only (Date title is in parent) */}
            <div className="flex items-center justify-end">
                <Button size="sm" onClick={() => { setSelectedHour(undefined); setCreateDialogOpen(true) }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Event
                </Button>
            </div>

            {/* All-day events section */}
            {allDayEvents.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">All Day</h4>
                    <div className="space-y-1">
                        {allDayEvents.map(event => (
                            <EventCard
                                key={event.id}
                                event={event}
                                size="md"
                                showDelete={true}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Timeline */}
            <div className="border rounded-lg bg-background overflow-hidden">
                {hours.map((hour) => {
                    const hourEvents = eventsByHour.get(hour.getHours()) || []
                    const isCurrentHour = isSameHour(hour, new Date())

                    return (
                        <div
                            key={hour.toISOString()}
                            className={cn(
                                "grid grid-cols-[80px_1fr] border-b last:border-b-0 min-h-[60px]",
                                isCurrentHour && "bg-primary/5"
                            )}
                        >
                            {/* Time label */}
                            <div className="p-3 text-sm font-medium text-muted-foreground border-r flex items-start">
                                {format(hour, 'h:mm a')}
                            </div>

                            {/* Events for this hour */}
                            <div
                                className="p-2 cursor-pointer hover:bg-muted/30 transition-colors relative"
                                onClick={(e) => {
                                    // Only trigger if clicking directly on this div (empty space), not on EventCards
                                    if (e.target === e.currentTarget) {
                                        handleHourClick(hour)
                                    }
                                }}
                            >
                                {hourEvents.length > 0 ? (
                                    <div
                                        className="space-y-1"
                                        onClick={(e) => {
                                            // Also allow clicking on the wrapper div (between cards)
                                            if (e.target === e.currentTarget) {
                                                handleHourClick(hour)
                                            }
                                        }}
                                    >
                                        {hourEvents.map(event => (
                                            <EventCard
                                                key={event.id}
                                                event={event}
                                                size="sm"
                                                showDelete={true}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div
                                        className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleHourClick(hour)
                                        }}
                                    >
                                        <span className="text-xs text-muted-foreground">Click to add event</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Create Event Dialog */}
            <CreateEventDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                defaultDate={selectedHour || date}
                projectId={projectId}
            />
        </div>
    )
}
