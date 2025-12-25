"use client"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
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
            priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
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
}

export function MonthGrid({ date, data, onDayClick }: MonthGridProps) {
    const monthStart = startOfMonth(date)
    const monthEnd = endOfMonth(date)
    const startDate = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)

    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: endDate,
    })

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {weekDays.map((day) => (
                    <div key={day} className="text-sm font-medium text-muted-foreground uppercase py-2">
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1 lg:gap-2 auto-rows-fr">
                {calendarDays.map((day) => {
                    // Find daily report for this day
                    const dailyData = data.dailyReports.find(r => isSameDay(new Date(r.date), day))

                    // Find tasks due this day
                    const priorityOrder = { 'URGENT': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
                    const allDaysTasks = data.tasks
                        .filter(t => t.deadline && isSameDay(new Date(t.deadline), day) && t.status !== 'DONE')
                        .sort((a, b) => (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2) - (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2))

                    // Find events on this day
                    const daysEvents = (data.events || [])
                        .filter(e => isSameDay(new Date(e.startTime), day))
                        .slice(0, 2) // Limit to 2 events for display

                    // Limit to 2 tasks for display (to make room for events)
                    const visibleTasks = allDaysTasks.slice(0, 2)
                    const remainingTasks = allDaysTasks.length - 2
                    const totalRemaining = Math.max(0, remainingTasks) + Math.max(0, (data.events || []).filter(e => isSameDay(new Date(e.startTime), day)).length - 2)

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

                    return (
                        <Card
                            key={day.toString()}
                            onClick={() => onDayClick?.(day)}
                            className={cn(
                                "min-h-[100px] p-2 flex flex-col justify-between transition-colors hover:bg-muted/30 cursor-pointer overflow-hidden",
                                !isSameMonth(day, monthStart) && "bg-muted/10 text-muted-foreground",
                                isToday(day) && "border-primary shadow-sm"
                            )}
                        >
                            <div className="flex justify-between items-start">
                                <span className={cn(
                                    "text-sm font-semibold h-7 w-7 flex items-center justify-center rounded-full",
                                    isToday(day) && "bg-primary text-primary-foreground"
                                )}>
                                    {format(day, 'd')}
                                </span>
                                {hoursWorked > 0 && (
                                    <span className={cn(
                                        "text-xs font-bold px-1.5 py-0.5 rounded",
                                        isTargetMet ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                                    )}>
                                        {hoursWorked.toFixed(1)}h
                                    </span>
                                )}
                            </div>

                            <div className="space-y-1 mt-2">
                                {/* Events */}
                                {daysEvents.map((event) => (
                                    <div
                                        key={event.id}
                                        className={cn(
                                            "text-[10px] truncate px-1 rounded border",
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

                                {/* Tasks */}
                                {visibleTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className={cn(
                                            "text-[10px] truncate px-1 rounded border",
                                            task.priority === 'URGENT' ? "bg-red-50 border-red-200 text-red-700" :
                                                task.priority === 'HIGH' ? "bg-orange-50 border-orange-200 text-orange-700" :
                                                    "bg-background border-border text-muted-foreground"
                                        )}
                                        title={`${task.title} - ${task.assignees?.map((u) => u.name).join(', ') || 'Unassigned'}`}
                                    >
                                        <div className="flex justify-between items-center gap-1">
                                            <span className="truncate">{task.title}</span>
                                            {task.assignees?.length > 0 && (
                                                <span className="text-[8px] opacity-70 uppercase tracking-tighter flex gap-0.5">
                                                    {task.assignees.slice(0, 2).map((u) => (
                                                        <span key={u.email}>{u.name.split(' ')[0]}</span>
                                                    ))}
                                                    {task.assignees.length > 2 && <span>+</span>}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {totalRemaining > 0 && (
                                    <div className="text-[10px] text-muted-foreground font-medium pl-1">
                                        +{totalRemaining} more...
                                    </div>
                                )}
                                {visibleTasks.length === 0 && daysEvents.length === 0 && hoursWorked === 0 && isSameMonth(day, monthStart) && !["Sat", "Sun"].includes(format(day, 'EEE')) && (
                                    <div className="h-full"></div> // Spacer
                                )}
                            </div>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
