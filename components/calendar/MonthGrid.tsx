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
            assignees: Array<{ name: string; email: string }>;
        }>
    }
}

export function MonthGrid({ date, data }: MonthGridProps) {
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
                    const daysTasks = data.tasks.filter(t => t.deadline && isSameDay(new Date(t.deadline), day))

                    const hoursWorked = dailyData?.totalDurationHours || 0
                    const isTargetMet = dailyData?.status === 'MET'

                    return (
                        <Card
                            key={day.toString()}
                            className={cn(
                                "min-h-[100px] p-2 flex flex-col justify-between transition-colors hover:bg-muted/30",
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
                                {daysTasks.map((task) => (
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
                                {daysTasks.length === 0 && hoursWorked === 0 && isSameMonth(day, monthStart) && !["Sat", "Sun"].includes(format(day, 'EEE')) && (
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
