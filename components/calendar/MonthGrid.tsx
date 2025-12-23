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
import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"


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
    }
}

export function MonthGrid({ date, data }: MonthGridProps) {
    const [selectedDay, setSelectedDay] = useState<Date | null>(null)
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
        <>
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

                        // Limit to 3 tasks for display
                        const visibleTasks = allDaysTasks.slice(0, 3)
                        const remainingTasks = allDaysTasks.length - 3

                        const hoursWorked = dailyData?.totalDurationHours || 0
                        const isTargetMet = dailyData?.status === 'MET'

                        return (
                            <Card
                                key={day.toString()}
                                onClick={() => setSelectedDay(day)}
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
                                    {remainingTasks > 0 && (
                                        <div className="text-[10px] text-muted-foreground font-medium pl-1">
                                            +{remainingTasks} more...
                                        </div>
                                    )}
                                    {visibleTasks.length === 0 && hoursWorked === 0 && isSameMonth(day, monthStart) && !["Sat", "Sun"].includes(format(day, 'EEE')) && (
                                        <div className="h-full"></div> // Spacer
                                    )}
                                </div>
                            </Card>
                        )
                    })}
                </div>
            </div>

            {/* Day Detail Dialog */}
            <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
                <DialogContent className="sm:max-w-[425px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedDay && format(selectedDay, 'EEEE, MMMM d, yyyy')}</DialogTitle>
                    </DialogHeader>

                    {selectedDay && (() => {
                        const dailyData = data.dailyReports.find(r => isSameDay(new Date(r.date), selectedDay))
                        const priorityOrder = { 'URGENT': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
                        const daysTasks = data.tasks
                            .filter(t => t.deadline && isSameDay(new Date(t.deadline), selectedDay) && t.status !== 'DONE')
                            .sort((a, b) => (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2) - (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2))

                        const hoursWorked = dailyData?.totalDurationHours || 0

                        return (
                            <div className="space-y-6 pt-4">
                                {/* Stats */}
                                <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg">
                                    <div className="text-sm font-medium">Total Work Hours</div>
                                    <div className="text-2xl font-bold font-mono text-primary">
                                        {hoursWorked.toFixed(1)}h
                                    </div>
                                </div>

                                {/* Tasks List */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tasks Due</h4>
                                    {daysTasks.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic">No tasks due on this day.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {daysTasks.map(task => (
                                                <div key={task.id} className="p-3 border rounded-lg bg-card space-y-2">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <span className="font-medium text-sm leading-tight">{task.title}</span>
                                                        <Badge variant="outline" className={cn(
                                                            "text-[10px] px-1.5 py-0 h-5 border",
                                                            task.priority === 'URGENT' ? "bg-red-50 text-red-700 border-red-200" :
                                                                task.priority === 'HIGH' ? "bg-orange-50 text-orange-700 border-orange-200" :
                                                                    "bg-white text-muted-foreground"
                                                        )}>
                                                            {task.priority}
                                                        </Badge>
                                                    </div>

                                                    {task.deadline && format(new Date(task.deadline), 'HH:mm') !== '00:00' && (
                                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                                            {format(new Date(task.deadline), 'h:mm a')}
                                                        </div>
                                                    )}

                                                    {task.assignees && task.assignees.length > 0 && (
                                                        <div className="flex -space-x-1.5 pt-1">
                                                            {task.assignees.map((u, i) => (
                                                                <div key={i} className="h-6 w-6 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center text-[10px] font-bold text-primary" title={u.name}>
                                                                    {u.name.substring(0, 1)}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })()}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSelectedDay(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
