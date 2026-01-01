"use client"

import { Button } from "@/components/ui/button"
import { format, eachHourOfInterval, isSameHour, isSameDay } from "date-fns"
import { EventCard } from "./EventCard"
import { CreateEventDialog } from "./CreateEventDialog"
import { cn } from "@/lib/utils"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useLanguage } from "@/lib/useLanguage"

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
        startDate?: Date | string | null
        deadline: Date | string | null
        priority: string
        status: string
        description: string | null
        assignees: Array<{ name: string; email: string }>
    }>
    projectId?: string | null
    onBack?: () => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onOptimisticEventCreate?: (event: any) => void
}

export function DayView({ date, events, tasks, projectId, onOptimisticEventCreate }: DayViewProps) {
    const { t } = useLanguage()
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [selectedHour, setSelectedHour] = useState<Date | undefined>()

    // Generate hours from 6 AM to 11 PM
    const dayStart = new Date(date)
    dayStart.setHours(6, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 0, 0, 0)

    const hours = eachHourOfInterval({ start: dayStart, end: dayEnd })

    // Process tasks into event-like objects
    // Task appears on day if: (has startDate and deadline: day is between them) OR (only deadline: day is deadline) OR (only startDate: day >= startDate)
    const taskEvents = tasks
        .filter(t => {
            if (t.status === 'DONE') return false
            const taskStartDate = (t as any).startDate ? new Date((t as any).startDate) : null
            const taskDeadline = t.deadline ? new Date(t.deadline) : null
            
            // Normalize dates to start of day for comparison (ignore time component)
            const dayStart = new Date(date)
            dayStart.setHours(0, 0, 0, 0)
            
            // Task is active on this day if:
            // 1. Has startDate and deadline: day is between startDate and deadline (date only, ignore time)
            // 2. Has only deadline: day is deadline (date only)
            // 3. Has only startDate: day >= startDate (date only)
            if (taskStartDate && taskDeadline) {
                const startDateOnly = new Date(taskStartDate)
                startDateOnly.setHours(0, 0, 0, 0)
                const deadlineOnly = new Date(taskDeadline)
                deadlineOnly.setHours(0, 0, 0, 0)
                return dayStart >= startDateOnly && dayStart <= deadlineOnly
            } else if (taskDeadline) {
                return isSameDay(taskDeadline, date)
            } else if (taskStartDate) {
                const startDateOnly = new Date(taskStartDate)
                startDateOnly.setHours(0, 0, 0, 0)
                return dayStart >= startDateOnly
            }
            return false
        })
        .map(t => {
            const taskStartDate = (t as any).startDate ? new Date((t as any).startDate) : null
            const taskDeadline = t.deadline ? new Date(t.deadline) : null
            
            // If task has both startDate and deadline, show as a time range
            if (taskStartDate && taskDeadline) {
                // Check if times are at midnight (date-only)
                const startIsMidnight = taskStartDate.getUTCHours() === 0 && taskStartDate.getUTCMinutes() === 0 && taskStartDate.getUTCSeconds() === 0
                const deadlineIsMidnight = taskDeadline.getUTCHours() === 0 && taskDeadline.getUTCMinutes() === 0 && taskDeadline.getUTCSeconds() === 0
                
                return {
                    id: t.id,
                    title: t.title,
                    description: t.description || `Status: ${t.status} | Priority: ${t.priority}`,
                    startTime: taskStartDate,
                    endTime: taskDeadline,
                    allDay: startIsMidnight && deadlineIsMidnight, // All day only if both are midnight
                    type: "TASK_TIME",
                    location: null,
                    createdBy: { name: "System", email: "" },
                    participants: t.assignees.map(a => ({ user: a }))
                }
            } else if (taskDeadline) {
                // Only deadline - show as a point in time
                const deadline = new Date(taskDeadline)
                const isUtcMidnight = deadline.getUTCHours() === 0 && deadline.getUTCMinutes() === 0 && deadline.getUTCSeconds() === 0
                
                return {
                    id: t.id,
                    title: t.title,
                    description: t.description || `Status: ${t.status} | Priority: ${t.priority}`,
                    startTime: deadline,
                    endTime: new Date(deadline), // Same as startTime to show only deadline time
                    allDay: isUtcMidnight,
                    type: "TASK_TIME",
                    location: null,
                    createdBy: { name: "System", email: "" },
                    participants: t.assignees.map(a => ({ user: a }))
                }
            } else if (taskStartDate) {
                // Only startDate - show as starting point
                const startDate = new Date(taskStartDate)
                const isUtcMidnight = startDate.getUTCHours() === 0 && startDate.getUTCMinutes() === 0 && startDate.getUTCSeconds() === 0
                
                return {
                    id: t.id,
                    title: t.title,
                    description: t.description || `Status: ${t.status} | Priority: ${t.priority}`,
                    startTime: startDate,
                    endTime: new Date(startDate), // Same as startTime
                    allDay: isUtcMidnight,
                    type: "TASK_TIME",
                    location: null,
                    createdBy: { name: "System", email: "" },
                    participants: t.assignees.map(a => ({ user: a }))
                }
            }
            
            // Fallback (shouldn't happen due to filter above)
            const deadline = new Date(t.deadline!)
            return {
                id: t.id,
                title: t.title,
                description: t.description || `Status: ${t.status} | Priority: ${t.priority}`,
                startTime: deadline,
                endTime: new Date(deadline),
                allDay: true,
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
                    {t('calendar.addEvent')}
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
                onOptimisticEventCreate={onOptimisticEventCreate}
            />
        </div>
    )
}
