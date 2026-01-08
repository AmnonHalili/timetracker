"use client"

import { Button } from "@/components/ui/button"
import { format, eachHourOfInterval, isSameHour, isSameDay } from "date-fns"
import { EventCard } from "./EventCard"
import { CreateEventDialog } from "./CreateEventDialog"
import { cn } from "@/lib/utils"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useLanguage } from "@/lib/useLanguage"
import { startOfDay, endOfDay, setHours } from "date-fns"
import { useRef, useEffect } from "react"
interface CalendarEvent {
    id: string
    title: string
    description?: string | null
    startTime: Date | string
    endTime: Date | string
    allDay: boolean
    type: string
    location?: string | null
    isHoliday?: boolean
    createdBy?: {
        name: string
        email: string
    }
    participants?: Array<{
        user: { name: string; email: string }
    }>
}

interface DayViewProps {
    date: Date
    events: CalendarEvent[]
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
    onOptimisticEventCreate?: (event: CalendarEvent) => void
    onOptimisticEventDelete?: (eventId: string) => void
}

export function DayView({ date, events, tasks, projectId, onOptimisticEventCreate, onOptimisticEventDelete }: DayViewProps) {
    const { t } = useLanguage()
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [selectedHour, setSelectedHour] = useState<Date | undefined>()

    // Generate hours for the full day (00:00 - 23:59)
    const dayStart = startOfDay(date)
    const dayEnd = endOfDay(date)
    const hours = eachHourOfInterval({ start: dayStart, end: dayEnd })

    // Auto-scroll logic
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const hourRefs = useRef<Map<number, HTMLDivElement>>(new Map())

    useEffect(() => {
        // Scroll to 06:00 on mount or date change
        const hourTarget = 6
        const element = hourRefs.current.get(hourTarget)

        if (element && scrollContainerRef.current) {
            // Use setTimeout to ensure layout is ready
            setTimeout(() => {
                element.scrollIntoView({ behavior: "smooth", block: "start" })
            }, 100)
        }
    }, [date])

    // Process tasks into event-like objects
    const taskEvents = tasks
        .filter(t => t.deadline && isSameDay(new Date(t.deadline), date) && t.status !== 'DONE')
        .map(t => {
            const deadline = new Date(t.deadline!)
            // Detect "Date Only" (stored as UTC Midnight)
            // If the time is exactly 00:00:00.000Z, we treat it as All Day (User likely picked just a date)
            const isUtcMidnight = deadline.getUTCHours() === 0 && deadline.getUTCMinutes() === 0 && deadline.getUTCSeconds() === 0

            // For tasks with deadlines, show only the deadline time (not a duration)
            // Set endTime equal to startTime so it appears as a point in time
            const endTime = new Date(deadline)

            return {
                id: t.id,
                title: t.title,
                description: t.description || `Status: ${t.status} | Priority: ${t.priority}`,
                startTime: deadline,
                endTime: endTime, // Same as startTime to show only deadline time
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
        <div className="flex flex-col h-full gap-4">


            {/* All-day events section */}
            {allDayEvents.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">{t('calendar.allDay')}</h4>
                    <div className="space-y-1">
                        {allDayEvents.map(event => (
                            <EventCard
                                key={event.id}
                                event={event}
                                size="md"
                                showDelete={true}
                                onOptimisticEventDelete={onOptimisticEventDelete}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Timeline */}
            <div
                ref={scrollContainerRef}
                className="border rounded-lg bg-background scroll-smooth relative"
            >
                {hours.map((hour) => {
                    const hourEvents = eventsByHour.get(hour.getHours()) || []
                    const isCurrentHour = isSameHour(hour, new Date())

                    return (
                        <div
                            key={hour.toISOString()}
                            ref={(el) => {
                                if (el) hourRefs.current.set(hour.getHours(), el)
                                else hourRefs.current.delete(hour.getHours())
                            }}
                            className={cn(
                                "grid grid-cols-[70px_1fr] border-b last:border-b-0 min-h-[60px]",
                                isCurrentHour && "bg-primary/5"
                            )}
                        >
                            {/* Time label */}
                            <div className="p-3 text-sm font-medium text-muted-foreground border-r border-l flex items-center justify-center whitespace-nowrap">
                                {format(hour, 'HH:mm')}
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
                                                onOptimisticEventDelete={onOptimisticEventDelete}
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
                                        <span className="text-xs text-muted-foreground">{t('calendar.clickToAddEvent')}</span>
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
                onOptimisticEventCreate={onOptimisticEventCreate}
            />
        </div>
    )
}
