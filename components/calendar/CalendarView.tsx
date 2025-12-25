"use client"

import { useState, useEffect } from "react"
import { MonthGrid } from "./MonthGrid"
import { DayView } from "./DayView"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react"
import { format, addMonths, subMonths, addDays, subDays } from "date-fns"
import { useRouter } from "next/navigation"

type CalendarEvent = {
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
}

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
        events?: Array<CalendarEvent>
    }
    projectId?: string | null
}

export function CalendarView({ initialDate, data, projectId }: CalendarViewProps) {
    const router = useRouter()
    const [view, setView] = useState<'month' | 'day'>('month')
    const [currentDate, setCurrentDate] = useState(initialDate)
    const [optimisticEvents, setOptimisticEvents] = useState<CalendarEvent[]>([])

    // Client-side data fetching state
    const [calendarData, setCalendarData] = useState(data)
    const [isLoading, setIsLoading] = useState(false)

    // Reset optimistic state when server data changes
    useEffect(() => {
        setOptimisticEvents([])
    }, [calendarData.events])

    // Fetch data when month changes
    useEffect(() => {
        const fetchCalendarData = async () => {
            // If current month matches initial month (and we haven't fetched yet or logic requires), 
            // we could reuse props, but determining if "props are stale" is tricky if we stay on page long.
            // For now, let's say if it matches initialDate month/year, we MIGHT reuse, but 
            // the user wants "fresh" data.

            // Actually, simply checking if month/year changed from what we have in calendarData?
            // But calendarData is state. 
            // Let's just fetch when month changes.

            const month = currentDate.getMonth()
            const year = currentDate.getFullYear()

            // Optional: debounce or check if we already have data for this month?
            // Simpler: Just fetch.

            setIsLoading(true)
            try {
                const res = await fetch(`/api/calendar?month=${month}&year=${year}`)
                if (!res.ok) throw new Error("Failed to fetch calendar data")
                const newData = await res.json()
                setCalendarData(newData)
            } catch (error) {
                console.error("Failed to load calendar data", error)
                // Fallback or toast?
            } finally {
                setIsLoading(false)
            }
        }

        // Only fetch if the displayed month is different from the currently loaded data context
        // We can infer context from the first event or just always fetch on navigation?
        // Let's compare with initialDate to avoid double-fetch on mount?
        // On mount, currentDate == initialDate, data == initial props.
        // We should skip fetch on FIRST render if it matches initial.

        const isInitialMonth =
            currentDate.getMonth() === initialDate.getMonth() &&
            currentDate.getFullYear() === initialDate.getFullYear()

        // Track the "loaded" month in a ref or just rely on the effect dependency?
        // The issue is: on mount, this runs. We have data. We don't want to refetch immediately unless we want "live" updates.
        // Let's skip if it matches initialDate AND we haven't navigated yet.
        // But simpler: just add a ref `isFirstRender`?

    }, [currentDate]) // Check inside effect

    // Re-implemented effect with proper logic
    useEffect(() => {
        const loadData = async () => {
            // Avoid fetching if it's the initial data we already have
            // But we want to re-fetch if we navigate BACK to initial month?
            // Maybe store "loadedMonth" state?
            // For simplicity and robustness to solve "Delay":
            // Fetching on mount is okay (double check), but wasteful.
            // Let's use a condition.

            const dataDate = new Date() // How to know date of `calendarData`? 
            // We don't.

            // Let's just fetch. It ensures data is fresh even on back navigation.
            // To prevent initial double fetch:
            if (currentDate.getTime() === initialDate.getTime() && calendarData === data) {
                return
            }

            setIsLoading(true)
            try {
                const res = await fetch(`/api/calendar?month=${currentDate.getMonth()}&year=${currentDate.getFullYear()}`)
                if (res.ok) {
                    const newData = await res.json()
                    setCalendarData(newData)
                }
            } finally {
                setIsLoading(false)
            }
        }

        loadData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDate])


    const mergedEvents = [...(calendarData.events || []), ...optimisticEvents]

    const addOptimisticEvent = (newEvent: CalendarEvent) => {
        setOptimisticEvents(prev => [...prev, newEvent])
    }

    const handlePrevMonth = () => {
        setCurrentDate(prev => subMonths(prev, 1))
    }

    const handleNextMonth = () => {
        setCurrentDate(prev => addMonths(prev, 1))
    }

    const handlePrevDay = () => {
        setCurrentDate(prev => subDays(prev, 1))
    }

    const handleNextDay = () => {
        setCurrentDate(prev => addDays(prev, 1))
    }

    const handleToday = () => {
        setCurrentDate(new Date())
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
                    data={{ ...calendarData, events: mergedEvents }}
                    onDayClick={(day) => {
                        setCurrentDate(day)
                        setView('day')
                        // No URL update
                    }}
                    projectId={projectId}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onOptimisticEventCreate={(event: any) => {
                        addOptimisticEvent(event)
                    }}
                    isLoading={isLoading}
                />
            ) : (
                <DayView
                    date={currentDate}
                    events={mergedEvents}
                    tasks={calendarData.tasks || []}
                    projectId={projectId}
                    onBack={() => setView('month')}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onOptimisticEventCreate={(event: any) => {
                        addOptimisticEvent(event)
                    }}
                />
            )}
        </div>
    )
}
