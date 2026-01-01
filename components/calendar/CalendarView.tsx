"use client"

import { useState, useEffect } from "react"
import { MonthGrid } from "./MonthGrid"
import { DayView } from "./DayView"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react"
import { addMonths, subMonths, addDays, subDays } from "date-fns"
import { useLanguage } from "@/lib/useLanguage"

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
            priority: 'HIGH' | 'MEDIUM' | 'LOW';
            status: string;
            description: string | null;
            assignees: Array<{ name: string; email: string }>;
        }>
        events?: Array<CalendarEvent>
    }
    projectId?: string | null
}

export function CalendarView({ initialDate, data, projectId }: CalendarViewProps) {
    const { t, isRTL } = useLanguage()
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
        const loadData = async () => {
            // To prevent initial double fetch:
            // This condition checks if the current date is the same as the initial date
            // AND if the calendarData state is still the initial data prop.
            // This prevents refetching on the very first render if the initial data is already provided.
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
        // The effect should re-run when currentDate changes.
        // initialDate and data are stable props, calendarData is state updated by this effect.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDate, initialDate, data])


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
                                <ArrowLeft className={`h-5 w-5 ${isRTL ? 'rotate-180' : ''}`} />
                            </Button>
                        )}
                    </div>

                    <h2 className="text-3xl font-bold tracking-tight">
                        {view === 'month'
                            ? `${t(`months.${['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][currentDate.getMonth()]}` as 'months.january' | 'months.february' | 'months.march' | 'months.april' | 'months.may' | 'months.june' | 'months.july' | 'months.august' | 'months.september' | 'months.october' | 'months.november' | 'months.december')} ${currentDate.getFullYear()}`
                            : `${t(`days.${['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][currentDate.getDay()]}` as 'days.sunday' | 'days.monday' | 'days.tuesday' | 'days.wednesday' | 'days.thursday' | 'days.friday' | 'days.saturday')}, ${t(`months.${['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][currentDate.getMonth()]}` as 'months.january' | 'months.february' | 'months.march' | 'months.april' | 'months.may' | 'months.june' | 'months.july' | 'months.august' | 'months.september' | 'months.october' | 'months.november' | 'months.december')} ${currentDate.getDate()}, ${currentDate.getFullYear()}`
                        }
                    </h2>
                </div>

                {/* Navigation Controls */}
                <div className="flex items-center border rounded-md bg-background shadow-sm">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={view === 'month'
                            ? (isRTL ? handleNextMonth : handlePrevMonth)
                            : (isRTL ? handleNextDay : handlePrevDay)
                        }
                    >
                        {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </Button>
                    <div className="w-[1px] h-6 bg-border" />
                    <Button variant="ghost" size="icon" onClick={handleToday}>
                        <span className="text-xs font-medium px-2">{t('calendar.today')}</span>
                    </Button>
                    <div className="w-[1px] h-6 bg-border" />
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={view === 'month'
                            ? (isRTL ? handlePrevMonth : handleNextMonth)
                            : (isRTL ? handlePrevDay : handleNextDay)
                        }
                    >
                        {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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
