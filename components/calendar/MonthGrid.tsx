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
import { Plus } from "lucide-react"
import { useState } from "react"
import { CreateEventDialog } from "./CreateEventDialog"
import { useLanguage } from "@/lib/useLanguage"


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
            startDate?: Date | string | null;
            deadline: Date | string | null;
            priority: 'HIGH' | 'MEDIUM' | 'LOW';
            status: string;
            assignees: Array<{ name: string; email: string }>;
        }>
        events?: Array<{
            id: string;
            title: string;
            startTime: Date | string;
            endTime: Date | string;
            allDay: boolean;
            type: string;
        }>
    }
    onDayClick?: (day: Date) => void
    projectId?: string | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onOptimisticEventCreate?: (event: any) => void
    isLoading?: boolean
}

export function MonthGrid({ date, data, onDayClick, projectId, onOptimisticEventCreate, isLoading }: MonthGridProps) {
    const { t } = useLanguage()
    const monthStart = startOfMonth(date)
    const monthEnd = endOfMonth(date)
    const startDate = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)

    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: endDate,
    })

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-end">
                <Button size="sm" onClick={() => { setSelectedDate(new Date()); setCreateDialogOpen(true) }}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('calendar.addEvent')}
                </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {weekDays.map((day) => (
                    <div key={day} className="text-sm font-medium text-muted-foreground uppercase py-2">
                        {day}
                    </div>
                ))}
            </div>

            <div className={cn("grid grid-cols-7 gap-0.5 lg:gap-1 relative", isLoading && "opacity-50 pointer-events-none")}>
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center z-50">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                )}
                {calendarDays.map((day) => {
                    // Find daily report for this day
                    const dailyData = data.dailyReports.find(r => isSameDay(new Date(r.date), day))

                    // Convert tasks to event-like objects for unified sorting
                    // Task appears on day if: (has startDate and deadline: day is between them) OR (only deadline: day is deadline) OR (only startDate: day >= startDate)
                    const taskEvents = data.tasks
                        .filter(t => {
                            if (t.status === 'DONE') return false
                            const taskStartDate = (t as any).startDate ? new Date((t as any).startDate) : null
                            const taskDeadline = t.deadline ? new Date(t.deadline) : null
                            
                            // Normalize dates to start of day for comparison (ignore time component)
                            const dayStart = new Date(day)
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
                                return isSameDay(taskDeadline, day)
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
                                    startTime: taskStartDate,
                                    endTime: taskDeadline,
                                    allDay: startIsMidnight && deadlineIsMidnight,
                                    type: "TASK_TIME",
                                    isTask: true,
                                    assignees: t.assignees
                                }
                            } else if (taskDeadline) {
                                // Only deadline - show as a point in time
                                const deadline = new Date(taskDeadline)
                                const isUtcMidnight = deadline.getUTCHours() === 0 && deadline.getUTCMinutes() === 0 && deadline.getUTCSeconds() === 0
                                
                                return {
                                    id: t.id,
                                    title: t.title,
                                    startTime: deadline,
                                    endTime: new Date(deadline),
                                    allDay: isUtcMidnight,
                                    type: "TASK_TIME",
                                    isTask: true,
                                    assignees: t.assignees
                                }
                            } else if (taskStartDate) {
                                // Only startDate - show as starting point
                                const startDate = new Date(taskStartDate)
                                const isUtcMidnight = startDate.getUTCHours() === 0 && startDate.getUTCMinutes() === 0 && startDate.getUTCSeconds() === 0
                                
                                return {
                                    id: t.id,
                                    title: t.title,
                                    startTime: startDate,
                                    endTime: new Date(startDate),
                                    allDay: isUtcMidnight,
                                    type: "TASK_TIME",
                                    isTask: true,
                                    assignees: t.assignees
                                }
                            }
                            
                            // Fallback (shouldn't happen due to filter above)
                            const deadline = new Date(t.deadline!)
                            return {
                                id: t.id,
                                title: t.title,
                                startTime: deadline,
                                endTime: new Date(deadline),
                                allDay: true,
                                type: "TASK_TIME",
                                isTask: true,
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

                    const eventTypeColors: Record<string, string> = {
                        MEETING: "bg-blue-50 border-blue-200 text-blue-700",
                        APPOINTMENT: "bg-purple-50 border-purple-200 text-purple-700",
                        TASK_TIME: "bg-green-50 border-green-200 text-green-700",
                        BREAK: "bg-gray-50 border-gray-200 text-gray-700",
                        PERSONAL: "bg-pink-50 border-pink-200 text-pink-700",
                        OTHER: "bg-orange-50 border-orange-200 text-orange-700",
                    }

                    // Check if there are any events or tasks for this day (for mobile indicator)
                    const hasEvents = sortedItems.length > 0

                    return (
                        <Card
                            key={day.toString()}
                            onClick={() => onDayClick?.(day)}
                            className={cn(
                                "aspect-square p-0.5 md:p-1 flex flex-col justify-between transition-colors hover:bg-muted/30 cursor-pointer overflow-hidden",
                                !isSameMonth(day, monthStart) && "bg-muted/10 text-muted-foreground",
                                isToday(day) && "border-primary shadow-sm"
                            )}
                        >
                            <div className="flex flex-col h-full">
                                {/* Header with date and hours */}
                                <div className="flex justify-between items-start mb-0.5">
                                    <span className={cn(
                                        "text-[10px] md:text-xs font-semibold h-4 w-4 md:h-5 md:w-5 flex items-center justify-center rounded-full",
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
                                    {/* Pink dot indicator on mobile if has events */}
                                    {hasEvents && (
                                        <span className="md:hidden w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" />
                                    )}
                                </div>

                                {/* Content - hidden on mobile, shown on desktop */}
                                <div className="hidden md:flex flex-col space-y-0.5 flex-1 min-h-0 mt-1 overflow-hidden">
                                    {/* Events and Tasks - sorted by time */}
                                    {visibleItems.map((item) => {
                                        // Determine colors: tasks use TASK_TIME color, events use their type color
                                        const itemColors = item.isTask
                                            ? "bg-[#004B7C]/10 text-[#004B7C] border-[#004B7C]/20"
                                            : (eventTypeColors[item.type] || eventTypeColors.OTHER)

                                        // For tasks, include assignees in tooltip
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        const taskAssignees = item.isTask ? (item as any).assignees : null

                                        const title = taskAssignees
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            ? `${item.title} - ${taskAssignees.map((u: any) => u.name).join(', ') || 'Unassigned'}`
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
                                            +{remainingCount}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    )
                })}
            </div>

            <CreateEventDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                defaultDate={selectedDate}
                projectId={projectId}
                onOptimisticEventCreate={onOptimisticEventCreate}
            />
        </div>
    )
}
