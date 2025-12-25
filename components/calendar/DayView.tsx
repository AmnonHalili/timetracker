"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { format, eachHourOfInterval, startOfDay, endOfDay, isSameHour, isSameDay, parseISO } from "date-fns"
import { EventCard } from "./EventCard"
import { CreateEventDialog } from "./CreateEventDialog"
import { cn } from "@/lib/utils"
import { Plus } from "lucide-react"

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
    projectId?: string | null
}

export function DayView({ date, events, projectId }: DayViewProps) {
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [selectedHour, setSelectedHour] = useState<Date | undefined>()

    // Generate hours from 6 AM to 11 PM
    const dayStart = new Date(date)
    dayStart.setHours(6, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 0, 0, 0)

    const hours = eachHourOfInterval({ start: dayStart, end: dayEnd })

    // Filter events to only those on this specific day
    const dayEvents = events.filter(e => isSameDay(new Date(e.startTime), date))

    // Sort events by start time
    const sortedEvents = [...dayEvents].sort((a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )

    // Group events by hour for the timeline
    const eventsByHour = new Map<number, typeof sortedEvents>()
    sortedEvents.forEach(event => {
        const eventStart = new Date(event.startTime)
        const hour = eventStart.getHours()
        if (!eventsByHour.has(hour)) {
            eventsByHour.set(hour, [])
        }
        eventsByHour.get(hour)?.push(event)
    })

    // All-day events (filtered for this day)
    const allDayEvents = dayEvents.filter(e => e.allDay)
    const timedEvents = dayEvents.filter(e => !e.allDay)

    const handleHourClick = (hour: Date) => {
        setSelectedHour(hour)
        setCreateDialogOpen(true)
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">
                    {format(date, 'EEEE, MMMM d, yyyy')}
                </h3>
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
                {hours.map((hour, index) => {
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
                                onClick={() => handleHourClick(hour)}
                            >
                                {hourEvents.length > 0 ? (
                                    <div className="space-y-1">
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
                                    <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
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
