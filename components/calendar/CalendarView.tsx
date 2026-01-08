"use client"

import { useRouter } from "next/navigation"

import { useState, useEffect } from "react"
import { MonthGrid } from "./MonthGrid"
import { DayView } from "./DayView"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { addMonths, subMonths, addDays, subDays, startOfMonth, endOfMonth } from "date-fns"
import { useLanguage } from "@/lib/useLanguage"
import { toast } from "sonner"
import { getHolidaysForRange } from "@/lib/holidays"
import { CreateEventDialog } from "./CreateEventDialog"

// ... (omitting lines for brevity in prompt but I need to target specific chunks)
// I will split this into multiple chunks or just do the import change and variable changes separately if needed.
// Actually I can do one block for imports if I target strictly.
// Let's do imports first.

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
    isExternal?: boolean;
    source?: 'google' | 'other';
    calendarId?: string;
    isHoliday?: boolean;
    color?: string;
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
            priority: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
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
    const { t, isRTL } = useLanguage()
    // const { data: session } = useSession() // Unused
    const [view, setView] = useState<'month' | 'day'>('month')
    const [currentDate, setCurrentDate] = useState(initialDate)
    const [optimisticEvents, setOptimisticEvents] = useState<CalendarEvent[]>([])
    const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<string[]>([])
    const [createDialogOpen, setCreateDialogOpen] = useState(false)

    // Client-side data fetching state (legacy)
    const [calendarData, setCalendarData] = useState(data)
    // const [isLoading, setIsLoading] = useState(false) // Unused

    // Local Holidays State - Load from localStorage
    const [showHolidays] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('calendar-show-holidays')
            return saved === 'true'
        }
        return false
    })

    // Calculate Holidays
    const [holidayEvents, setHolidayEvents] = useState<CalendarEvent[]>([])

    // Calculate Holidays effect
    useEffect(() => {
        async function fetchHolidays() {
            if (!showHolidays) {
                setHolidayEvents([])
                return
            }

            const start = startOfMonth(currentDate)
            const end = endOfMonth(currentDate)
            // Add a buffer to ensure we cover edge cases or view transitions
            const bufferStart = subDays(start, 7)
            const bufferEnd = addDays(end, 7)

            const toastId = toast.loading("Syncing holidays...")


            try {
                const rawHolidays = await getHolidaysForRange(bufferStart, bufferEnd)
                // Server actions serialize Dates to strings, so we must parse them back
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const holidays = rawHolidays.map((h: any) => ({
                    ...h,
                    startTime: new Date(h.startTime),
                    endTime: new Date(h.endTime)
                }))

                setHolidayEvents(holidays)

                if (holidays.length > 0) {
                    toast.success(`Found ${holidays.length} holidays`, { id: toastId })
                } else {
                    toast.info("No holidays found for this month", { id: toastId })
                }
            } catch (error) {
                console.error("Failed to fetch holidays", error)
                toast.error("Failed to sync holidays", { id: toastId })
            }
        }

        fetchHolidays()
    }, [currentDate, showHolidays])




    // Reset optimistic state when server data changes
    useEffect(() => {
        setOptimisticEvents([])
        setOptimisticDeletedIds([])
        setCalendarData(data) // Sync local state with prop data
    }, [data, calendarData.events])

    // URL Sync helper
    const syncUrlWithDate = (date: Date) => {
        if (date.getMonth() !== currentDate.getMonth() || date.getFullYear() !== currentDate.getFullYear()) {
            router.push(`/calendar?month=${date.getMonth()}&year=${date.getFullYear()}`)
        }
    }

    // REMOVED: Client-side data fetching. We now rely on URL params driving the Server Component.
    // useEffect(() => { ... })




    const handleOptimisticCreate = (newEvent: CalendarEvent) => {
        setOptimisticEvents(prev => [...prev, newEvent])
    }

    const handleOptimisticDelete = (eventId: string) => {
        setOptimisticDeletedIds(prev => [...prev, eventId])
        // If it was an optimistic event, remove it from that list too
        setOptimisticEvents(prev => prev.filter(e => e.id !== eventId))
    }

    // Filter out deleted events from display
    const visibleEvents = [...(calendarData.events || []), ...optimisticEvents, ...holidayEvents]
        .filter(event => !optimisticDeletedIds.includes(event.id) &&
            // Check for synthetic IDs of recurring events if the parent was deleted
            !optimisticDeletedIds.some(deletedId => event.id.startsWith(deletedId + '_')))

    const handlePrevMonth = () => {
        const newDate = subMonths(currentDate, 1)
        setCurrentDate(newDate)
        router.push(`/calendar?month=${newDate.getMonth()}&year=${newDate.getFullYear()}`)
    }

    const handleNextMonth = () => {
        const newDate = addMonths(currentDate, 1)
        setCurrentDate(newDate)
        router.push(`/calendar?month=${newDate.getMonth()}&year=${newDate.getFullYear()}`)
    }

    const handlePrevDay = () => {
        const newDate = subDays(currentDate, 1)
        setCurrentDate(newDate)
        syncUrlWithDate(newDate)
    }

    const handleNextDay = () => {
        const newDate = addDays(currentDate, 1)
        setCurrentDate(newDate)
        syncUrlWithDate(newDate)
    }

    const handleToday = () => {
        const newDate = new Date()
        setCurrentDate(newDate)
        syncUrlWithDate(newDate)
    }


    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] overflow-hidden gap-4 md:gap-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-0 shrink-0 py-2 md:border-none">
                {/* Left: Title */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-center md:justify-start">
                    {/* Back Button (Day View) */}
                    {view === 'day' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setView('month')}
                            className="h-9 w-9"
                        >
                            <ChevronLeft className={`h-5 w-5 ${isRTL ? 'rotate-180' : ''}`} />
                        </Button>
                    )}

                    {view === 'month' ? (
                        <div className="flex items-center gap-2 text-2xl font-bold tracking-tight text-primary">
                            <span>
                                {t(`months.${['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][currentDate.getMonth()]}` as any)}
                            </span>
                            <span className="text-muted-foreground font-medium">
                                {currentDate.getFullYear()}
                            </span>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            <h2 className="text-xl font-bold tracking-tight text-primary">
                                {t(`days.${['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][currentDate.getDay()]}` as any)}
                            </h2>
                            <span className="text-sm text-muted-foreground">
                                {t(`months.${['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][currentDate.getMonth()]}` as any)} {currentDate.getFullYear()}
                            </span>
                        </div>
                    )}
                </div>

                {/* Right: Controls & Actions */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-center md:justify-end">
                    {/* Navigation */}
                    <div className="flex items-center border rounded-lg bg-background shadow-sm shrink-0 overflow-hidden">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-none border-r"
                            onClick={view === 'month'
                                ? (isRTL ? handleNextMonth : handlePrevMonth)
                                : (isRTL ? handleNextDay : handlePrevDay)
                            }
                        >
                            <ChevronLeft className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-sm font-medium rounded-none px-3 h-8 hover:bg-transparent"
                            onClick={handleToday}
                        >
                            {t('calendar.today')}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-none border-l"
                            onClick={view === 'month'
                                ? (isRTL ? handlePrevMonth : handleNextMonth)
                                : (isRTL ? handlePrevDay : handleNextDay)
                            }
                        >
                            <ChevronRight className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
                        </Button>
                    </div>

                    {/* Add Event Button (Desktop Only) */}
                    <Button
                        size="sm"
                        onClick={() => setCreateDialogOpen(true)}
                        className="h-9 shadow-sm bg-primary text-primary-foreground font-medium px-4 gap-2 hidden md:flex"
                    >
                        <Plus className="h-4 w-4" />
                        {t('calendar.addEvent')}
                    </Button>
                </div>
            </div>

            {/* Floating Action Button (Mobile Only) */}
            <div className={`fixed bottom-6 z-50 md:hidden ${isRTL ? 'right-6' : 'left-6'}`}>
                <Button
                    size="sm"
                    onClick={() => { setCreateDialogOpen(true) }}
                    className="h-11 rounded-xl shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('calendar.addEvent')}
                </Button>
            </div>

            {/* Calendar Grid */}
            <div className="bg-background flex-1 overflow-hidden">
                {view === 'month' ? (
                    <MonthGrid
                        date={currentDate}
                        data={{
                            ...calendarData,
                            events: visibleEvents
                        }}
                        onDayClick={(day) => {
                            setCurrentDate(day)
                            setView('day')
                            syncUrlWithDate(day)
                        }}
                        projectId={projectId}
                        onOptimisticEventCreate={handleOptimisticCreate}
                        onOptimisticEventDelete={handleOptimisticDelete}
                        isLoading={false}
                    />
                ) : (
                    <DayView
                        date={currentDate}
                        events={visibleEvents}
                        tasks={calendarData.tasks || []}
                        projectId={projectId}
                        onBack={() => setView('month')}
                        onOptimisticEventCreate={handleOptimisticCreate}
                        onOptimisticEventDelete={handleOptimisticDelete}
                    />
                )}
            </div>
            <CreateEventDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                defaultDate={currentDate}
                projectId={projectId}
                onOptimisticEventCreate={handleOptimisticCreate}
            />
        </div>
    )
}
