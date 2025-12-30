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

                    // Find tasks due this day
                    const priorityOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
                    const allDaysTasks = data.tasks
                        .filter(t => t.deadline && isSameDay(new Date(t.deadline), day) && t.status !== 'DONE')
                        .sort((a, b) => (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2) - (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2))

                    // Find events on this day
                    const daysEvents = (data.events || [])
                        .filter(e => isSameDay(new Date(e.startTime), day))
                        .slice(0, 1) // Limit to 1 event for display in small cards

                    // Limit to 1 task for display (to make room for events)
                    const visibleTasks = allDaysTasks.slice(0, 1)
                    const remainingTasks = allDaysTasks.length - 1
                    const totalRemaining = Math.max(0, remainingTasks) + Math.max(0, (data.events || []).filter(e => isSameDay(new Date(e.startTime), day)).length - 1)

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

                    const hasEvents = (data.events || []).some(e => isSameDay(new Date(e.startTime), day))

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
                                <div className="hidden md:flex flex-col space-y-0.5 flex-1 min-h-0 mt-1">
                                    {/* Events - shown first at the top */}
                                    {daysEvents.map((event) => (
                                        <div
                                            key={event.id}
                                            className={cn(
                                                "text-[10px] truncate px-1 py-0.5 rounded border shrink-0",
                                                eventTypeColors[event.type] || eventTypeColors.OTHER
                                            )}
                                            title={event.title}
                                        >
                                            <span className="truncate flex items-center gap-1">
                                                <span className="w-1 h-1 rounded-full bg-current shrink-0" />
                                                {event.title}
                                            </span>
                                        </div>
                                    ))}

                                    {/* Tasks - shown after events */}
                                    {visibleTasks.map((task) => (
                                        <div
                                            key={task.id}
                                            className={cn(
                                                "text-[8px] truncate px-0.5 py-0 rounded border shrink-0",
                                                task.priority === 'HIGH' ? "bg-pink-700 text-white border-pink-800" :
                                                    task.priority === 'MEDIUM' ? "bg-pink-500 text-white border-pink-600" :
                                                        "bg-pink-300 text-white border-pink-400"
                                            )}
                                            title={`${task.title} - ${task.assignees?.map((u) => u.name).join(', ') || 'Unassigned'}`}
                                        >
                                            <span className="truncate">{task.title}</span>
                                        </div>
                                    ))}
                                    {totalRemaining > 0 && (
                                        <div className="text-[8px] text-muted-foreground font-medium shrink-0">
                                            +{totalRemaining}
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
