"use client"

import { Card } from "@/components/ui/card"
import { cn, formatHoursMinutes } from "@/lib/utils"
import {
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    format,
    isSameMonth,
    isToday,
    isSameDay
} from "date-fns"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/useLanguage"


interface MonthGridEvent {
    id: string;
    title: string;
    startTime: Date | string;
    endTime: Date | string;
    allDay: boolean;
    type: string;
    isTask?: boolean;
    isHoliday?: boolean;
    assignees?: Array<{ name: string; email: string }>;
}



interface MonthGridProps {
    date: Date
    data: {
        dailyReports: Array<{
            date: Date | string;
            totalDurationHours: number;
            status: string;
        }>
        tasks: Array<{
            id: string;
            title: string;
            deadline: Date | string | null;
            priority: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
            status: string;
            assignees: Array<{ name: string; email: string }>;
        }>
        events?: MonthGridEvent[]
    }
    onDayClick?: (day: Date) => void
    projectId?: string | null
    onOptimisticEventCreate?: (event: MonthGridEvent) => void
    onOptimisticEventDelete?: (eventId: string) => void
    isLoading?: boolean
}

export function MonthGrid({ date, data, onDayClick, projectId, onOptimisticEventCreate, isLoading }: MonthGridProps) {
    const { t, isRTL } = useLanguage()
    const monthStart = startOfMonth(date)
    const monthEnd = endOfMonth(date)
    const startDate = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)

    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: endDate,
    })

    const weekDays: Array<'days.sunday' | 'days.monday' | 'days.tuesday' | 'days.wednesday' | 'days.thursday' | 'days.friday' | 'days.saturday'> = [
        'days.sunday', 'days.monday', 'days.tuesday', 'days.wednesday', 'days.thursday', 'days.friday', 'days.saturday'
    ]

    return (
        <div className="h-full flex flex-col relative space-y-0">
            <div className="flex-1 overflow-y-auto relative">
                <div className="grid grid-cols-7 gap-1 text-center mb-0 shrink-0 sticky top-0 z-40 bg-background py-2">
                    {weekDays.map((day) => (
                        <div key={day} className="text-xs md:text-sm font-semibold md:font-medium text-muted-foreground uppercase">
                            {t(day).substring(0, 3)}
                        </div>
                    ))}
                </div>

                <div className={cn("grid grid-cols-7 gap-0.5 lg:gap-1 relative pb-1", isLoading && "opacity-50 pointer-events-none")}>
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center z-50">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        </div>
                    )}
                    {calendarDays.map((day) => {
                        // Find daily report for this day
                        const dailyData = data.dailyReports.find(r => isSameDay(new Date(r.date), day))

                        // Convert tasks to event-like objects for unified sorting
                        const taskEvents = data.tasks
                            .filter(t => t.deadline && isSameDay(new Date(t.deadline), day) && t.status !== 'DONE')
                            .map(t => {
                                const deadline = new Date(t.deadline!)
                                // Detect "Date Only" (stored as UTC Midnight)
                                const isUtcMidnight = deadline.getUTCHours() === 0 && deadline.getUTCMinutes() === 0 && deadline.getUTCSeconds() === 0

                                return {
                                    id: t.id,
                                    title: t.title,
                                    startTime: deadline,
                                    endTime: new Date(deadline),
                                    allDay: isUtcMidnight,
                                    type: "TASK_TIME",
                                    isTask: true, // Flag to identify tasks
                                    isHoliday: false,
                                    assignees: t.assignees
                                }
                            })

                        // Find all events on this day
                        const allDaysEvents = (data.events || [])
                            .filter(e => isSameDay(new Date(e.startTime), day))
                            .map(e => ({ ...e, isTask: false }))

                        // Combine events and tasks into one array
                        const allItems = [...allDaysEvents, ...taskEvents]

                        // Sort: allDay items first, then by startTime (earliest to latest)
                        const sortedItems = allItems.sort((a, b) => {
                            // All-day items come first
                            if (a.allDay && !b.allDay) return -1
                            if (!a.allDay && b.allDay) return 1
                            // If both are allDay or both are not, sort by startTime
                            const aTime = new Date(a.startTime).getTime()
                            const bTime = new Date(b.startTime).getTime()
                            return aTime - bTime
                        })

                        // Limit to 6 visible items
                        const maxVisibleItems = 6
                        const visibleItems = sortedItems.slice(0, maxVisibleItems)
                        const remainingCount = Math.max(0, sortedItems.length - maxVisibleItems)
                        const hoursWorked = dailyData?.totalDurationHours || 0
                        const isTargetMet = dailyData?.status === 'MET'

                        // Event colors - all events use one shade of primary theme color
                        const eventTypeColors: Record<string, string> = {
                            MEETING: "bg-primary/20 text-primary border-primary/30",
                            APPOINTMENT: "bg-primary/20 text-primary border-primary/30",
                            TASK_TIME: "bg-primary/60 text-primary-foreground border-primary/70", // Tasks use different shade
                            BREAK: "bg-muted/50 text-muted-foreground border-muted",
                            PERSONAL: "bg-primary/20 text-primary border-primary/30",
                            OTHER: "bg-primary/20 text-primary border-primary/30",
                            HOLIDAY: "bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
                        }

                        // Check if there are any events or tasks for this day (for mobile indicator)
                        const hasEvents = sortedItems.length > 0

                        return (
                            <Card
                                key={day.toString()}
                                onClick={() => onDayClick?.(day)}
                                className={cn(
                                    "aspect-square p-1 md:p-1 flex flex-col justify-between transition-colors hover:bg-muted/30 cursor-pointer overflow-hidden rounded-xl md:rounded-md",
                                    !isSameMonth(day, monthStart) && "bg-muted/10 text-muted-foreground",
                                    isToday(day) && "border-2 md:border border-primary shadow-md md:shadow-sm"
                                )}
                            >
                                <div className="flex flex-col h-full">
                                    {/* Header with date and hours */}
                                    <div className="flex justify-between items-start mb-0.5">
                                        <span className={cn(
                                            "text-xs md:text-xs font-semibold h-5 w-5 md:h-5 md:w-5 flex items-center justify-center rounded-full",
                                            isToday(day) && "bg-primary text-primary-foreground"
                                        )}>
                                            {format(day, 'd')}
                                        </span>
                                        {/* Hours worked - hidden on mobile, shown on desktop */}
                                        {hoursWorked > 0 && (
                                            <span className={cn(
                                                "hidden md:block text-[8px] font-bold px-0.5 py-0 rounded",
                                                isTargetMet ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                                            )}>
                                                {formatHoursMinutes(hoursWorked)}
                                            </span>
                                        )}
                                        {/* Event indicator dot on mobile if has events */}
                                        {hasEvents && (
                                            <span className="md:hidden w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                        )}
                                    </div>

                                    {/* Content - hidden on mobile, shown on desktop */}
                                    <div className="hidden md:flex flex-col space-y-0.5 flex-1 min-h-0 mt-1 overflow-hidden">
                                        {/* Events and Tasks - sorted by time */}
                                        {visibleItems.map((item) => {
                                            // Determine colors:
                                            // Tasks use one shade of primary, events use another shade
                                            let itemColors = eventTypeColors.OTHER
                                            if (item.isTask) {
                                                // Tasks use darker shade of primary
                                                itemColors = "bg-primary/60 text-primary-foreground border-primary/70"
                                            } else if (item.isHoliday) {
                                                itemColors = eventTypeColors.HOLIDAY
                                            } else {
                                                // Events use lighter shade of primary
                                                itemColors = eventTypeColors[item.type] || eventTypeColors.OTHER
                                            }

                                            // For tasks, include assignees in tooltip
                                            const taskAssignees = item.isTask ? item.assignees : null

                                            const title = taskAssignees
                                                ? `${item.title} - ${taskAssignees.map((u: { name: string }) => u.name).join(', ') || 'Unassigned'}`
                                                : item.title

                                            return (
                                                <div
                                                    key={item.id}
                                                    className={cn(
                                                        "text-[10px] truncate px-1 py-0.5 rounded border shrink-0",
                                                        itemColors
                                                    )}
                                                    title={title}
                                                >
                                                    <span className="truncate flex items-center gap-1">
                                                        <span className="w-1 h-1 rounded-full bg-current shrink-0" />
                                                        {item.title}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                        {remainingCount > 0 && (
                                            <div className="text-[10px] text-muted-foreground font-medium shrink-0">
                                                +{remainingCount} {t('calendar.clickToAddEvent')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        )
                    })}
                </div>
            </div>

        </div>
    )
}
