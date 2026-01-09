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
import { HeaderPortal } from "@/components/layout/HeaderPortal"
import { CalendarSettingsButton } from "./CalendarSettingsButton"

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
                const holidays = rawHolidays.map((h: { startTime: Date | string, endTime: Date | string }) => ({
                    ...h,
                    startTime: new Date(h.startTime),
                    endTime: new Date(h.endTime)
                })) as CalendarEvent[]

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
        <div className="flex flex-col gap-4 md:gap-6 pb-20 md:pb-0">
            <HeaderPortal>
                <div className="hidden md:flex items-center justify-between w-full gap-4">
                    {/* Left: Settings & Title */}
                    <div className="flex items-center gap-2 md:gap-4 shrink-0">
                        <CalendarSettingsButton />

                        <div className="flex items-center gap-2 md:gap-3">
                            {/* Back Button (Day View) */}
                            {view === 'day' && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setView('month')}
                                    className="h-8 w-8"
                                >
                                    <ChevronLeft className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
                                </Button>
                            )}

                            {view === 'month' ? (
                                <div className="flex items-center gap-1.5 md:gap-2 text-base md:text-xl font-bold tracking-tight text-primary">
                                    <span>
                                        {t(`months.${['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][currentDate.getMonth()]}` as unknown as import("@/lib/translations").TranslationKey)}
                                    </span>
                                    <span className="text-muted-foreground font-medium">
                                        {currentDate.getFullYear()}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex flex-col leading-none">
                                    <h2 className="text-sm md:text-lg font-bold tracking-tight text-primary">
                                        {t(`days.${['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][currentDate.getDay()]}` as unknown as import("@/lib/translations").TranslationKey)}
                                    </h2>
                                    <span className="text-[10px] md:text-xs text-muted-foreground font-medium">
                                        {t(`months.${['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][currentDate.getMonth()]}` as unknown as import("@/lib/translations").TranslationKey)} {currentDate.getFullYear()}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Navigation (Moved to Left) */}
                        <div className="flex items-center border rounded-lg bg-background shadow-xs shrink-0 overflow-hidden ml-2 md:ml-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 md:h-8 md:w-8 rounded-none border-r"
                                onClick={view === 'month'
                                    ? (isRTL ? handleNextMonth : handlePrevMonth)
                                    : (isRTL ? handleNextDay : handlePrevDay)
                                }
                            >
                                <ChevronLeft className={`h-3.5 w-3.5 md:h-4 md:w-4 ${isRTL ? 'rotate-180' : ''}`} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-[10px] md:text-sm font-medium rounded-none px-2 md:px-3 h-7 md:h-8 hover:bg-transparent"
                                onClick={handleToday}
                            >
                                {t('calendar.today')}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 md:h-8 md:w-8 rounded-none border-l"
                                onClick={view === 'month'
                                    ? (isRTL ? handlePrevMonth : handleNextMonth)
                                    : (isRTL ? handlePrevDay : handleNextDay)
                                }
                            >
                                <ChevronRight className={`h-3.5 w-3.5 md:h-4 md:w-4 ${isRTL ? 'rotate-180' : ''}`} />
                            </Button>
                        </div>
                    </div>

                    {/* Right: Controls & Actions */}
                    <div className="flex items-center gap-2 md:gap-3 shrink-0">
                        {/* Add Event Button (Desktop Only) */}
                        <Button
                            size="sm"
                            onClick={() => setCreateDialogOpen(true)}
                            className="h-8 shadow-sm bg-primary text-primary-foreground text-xs font-medium px-3 gap-1.5 hidden md:flex"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            {t('calendar.addEvent')}
                        </Button>
                    </div>
                </div>
            </HeaderPortal>

            {/* Mobile Header (Inline - Restored Original Layout) */}
            <div className="flex flex-col items-center gap-4 py-2 shrink-0 md:hidden">
                {/* Title */}
                {view === 'month' ? (
                    <div className="flex items-center gap-2 text-xl font-bold tracking-tight text-primary">
                        <span>
                            {t(`months.${['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][currentDate.getMonth()]}` as unknown as import("@/lib/translations").TranslationKey)}
                        </span>
                        <span className="text-muted-foreground font-medium">
                            {currentDate.getFullYear()}
                        </span>
                    </div>
                ) : (
                    <div className="relative w-full flex items-center justify-center">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setView('month')}
                            className="absolute left-0 h-8 w-8"
                        >
                            <ChevronLeft className={`h-5 w-5 ${isRTL ? 'rotate-180' : ''}`} />
                        </Button>
                        <div className="flex flex-col items-center">
                            <h2 className="text-lg font-bold tracking-tight text-primary">
                                {t(`days.${['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][currentDate.getDay()]}` as unknown as import("@/lib/translations").TranslationKey)}
                            </h2>
                            <span className="text-xs text-muted-foreground font-medium">
                                {t(`months.${['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][currentDate.getMonth()]}` as unknown as import("@/lib/translations").TranslationKey)} {currentDate.getFullYear()}
                            </span>
                        </div>
                    </div>
                )}

                {/* Navigation (Mobile Centered) */}
                <div className="flex items-center border rounded-lg bg-background shadow-sm shrink-0 overflow-hidden">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-none border-r"
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
                        className="text-sm font-medium rounded-none px-4 h-9 hover:bg-transparent min-w-[80px]"
                        onClick={handleToday}
                    >
                        {t('calendar.today')}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-none border-l"
                        onClick={view === 'month'
                            ? (isRTL ? handlePrevMonth : handleNextMonth)
                            : (isRTL ? handlePrevDay : handleNextDay)
                        }
                    >
                        <ChevronRight className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
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
            <div className="bg-background flex-1">
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
                defaultDate={view === 'month' ? new Date() : currentDate}
                projectId={projectId}
                onOptimisticEventCreate={handleOptimisticCreate}
                fromMonthView={view === 'month'}
            />
        </div>
    )
}
