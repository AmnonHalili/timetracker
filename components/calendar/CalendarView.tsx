"use client"

import { MonthGrid } from "./MonthGrid"
import { DayView } from "./DayView"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react"
import { format, addMonths, subMonths, addDays, subDays } from "date-fns"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface CalendarViewProps {
    initialDate: Date
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
            description: string | null;
            assignees: Array<{ name: string; email: string }>;
        }>
        events?: Array<{
            id: string;
            title: string;
            description?: string | null;
            startTime: Date | string;
            endTime: Date | string;
            allDay: boolean;
            type: string;
            location?: string | null;
            createdBy?: {
                name: string;
                email: string;
            };
            participants?: Array<{
                user: { name: string; email: string };
            }>;
        }>
    }
    projectId?: string | null
}

export function CalendarView({ initialDate, data, projectId }: CalendarViewProps) {
    const router = useRouter()
    const [view, setView] = useState<'month' | 'day'>('month')
    const [currentDate, setCurrentDate] = useState(initialDate)

    const handlePrevMonth = () => {
        const newDate = subMonths(currentDate, 1)
        setCurrentDate(newDate)
        updateUrl(newDate)
    }

    const handleNextMonth = () => {
        const newDate = addMonths(currentDate, 1)
        setCurrentDate(newDate)
        updateUrl(newDate)
    }

    const handlePrevDay = () => {
        const newDate = subDays(currentDate, 1)
        setCurrentDate(newDate)
        updateUrl(newDate)
    }

    const handleNextDay = () => {
        const newDate = addDays(currentDate, 1)
        setCurrentDate(newDate)
        updateUrl(newDate)
    }

    const updateUrl = (date: Date) => {
        const params = new URLSearchParams(window.location.search)
        params.set("month", date.getMonth().toString())
        params.set("year", date.getFullYear().toString())
        router.push(`/calendar?${params.toString()}`)
    }

    const handleToday = () => {
        const today = new Date()
        setCurrentDate(today)
        updateUrl(today)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    {/* Back Button / Placeholder-like container for stability */}
                    <div className="w-10 flex justify-start">
                        {view === 'day' && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setView('month')}
                                className="-ml-2"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        )}
                    </div>

                    <h2 className="text-3xl font-bold tracking-tight">
                        {view === 'month' ? format(currentDate, "MMMM yyyy") : format(currentDate, "EEEE, MMMM d, yyyy")}
                    </h2>
                </div>

                {/* Navigation Controls */}
                <div className="flex items-center border rounded-md bg-background shadow-sm">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={view === 'month' ? handlePrevMonth : handlePrevDay}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="w-[1px] h-6 bg-border" />
                    <Button variant="ghost" size="icon" onClick={handleToday}>
                        <span className="text-xs font-medium px-2">Today</span>
                    </Button>
                    <div className="w-[1px] h-6 bg-border" />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={view === 'month' ? handleNextMonth : handleNextDay}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {view === 'month' ? (
                <MonthGrid
                    date={currentDate}
                    data={data}
                    onDayClick={(day) => {
                        setCurrentDate(day)
                        setView('day')
                        updateUrl(day)
                    }}
                    projectId={projectId}
                />
            ) : (
                <DayView
                    date={currentDate}
                    events={data.events || []}
                    tasks={data.tasks || []}
                    projectId={projectId}
                    onBack={() => setView('month')}
                />
            )}
        </div>
    )
}
