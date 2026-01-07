"use client"

import { useState, useEffect } from "react"
import { MonthGrid } from "./MonthGrid"
import { DayView } from "./DayView"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ArrowLeft, Settings, PartyPopper } from "lucide-react"
import { addMonths, subMonths, addDays, subDays, startOfMonth, endOfMonth } from "date-fns"
import { useLanguage } from "@/lib/useLanguage"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { signIn } from "next-auth/react"
import { toast } from "sonner"
import { getHolidaysForRange } from "@/lib/holidays"

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
    // const { data: session } = useSession() // Unused
    const [view, setView] = useState<'month' | 'day'>('month')
    const [currentDate, setCurrentDate] = useState(initialDate)
    const [optimisticEvents, setOptimisticEvents] = useState<CalendarEvent[]>([])

    // Client-side data fetching state
    const [calendarData, setCalendarData] = useState(data)
    const [isLoading, setIsLoading] = useState(false)

    // Local Holidays State
    const [showHolidays, setShowHolidays] = useState(false)

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

    // Settings State
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [syncSettings, setSyncSettings] = useState<{
        isGoogleCalendarSyncEnabled: boolean;
        syncMode: string;
        syncedCalendarIds?: string[];
    }>({
        isGoogleCalendarSyncEnabled: false,
        syncMode: 'FULL_DETAILS',
        syncedCalendarIds: []
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [availableCalendars, setAvailableCalendars] = useState<any[]>([])

    // Fetch settings on mount
    const [isGoogleLinked, setIsGoogleLinked] = useState(false)
    const [hasRefreshToken, setHasRefreshToken] = useState(false)

    // Fetch settings and linked status
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/calendar/settings')
                if (res.ok) {
                    const data = await res.json()
                    setSyncSettings({
                        isGoogleCalendarSyncEnabled: data.isGoogleCalendarSyncEnabled,
                        syncMode: data.syncMode || "FULL_DETAILS",
                        syncedCalendarIds: data.syncedCalendarIds || ["primary"]
                    })
                    setIsGoogleLinked(data.isGoogleLinked)
                    setHasRefreshToken(data.hasRefreshToken)
                    setAvailableCalendars(data.availableCalendars || [])
                }
            } catch (error) {
                console.error("Failed to fetch settings", error)
            }
        }
        fetchSettings()
    }, [])



    // Reset optimistic state when server data changes
    useEffect(() => {
        setOptimisticEvents([])
    }, [calendarData.events])

    // Fetch data when month changes
    useEffect(() => {
        const loadData = async () => {
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
    }, [currentDate, initialDate, data])




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

    const handleConnectGoogle = async () => {
        toast.loading("Redirecting to Google for authorization...")
        // Trigger NextAuth sign in with Google provider and extra scopes
        await signIn('google', {
            callbackUrl: window.location.href,
            redirect: true,
        })
    }

    const handleUpdateSettings = async (updates: Partial<typeof syncSettings>) => {
        const newSettings = { ...syncSettings, ...updates }

        // Optimistic UI Update: Frame the future state immediately
        setSyncSettings(newSettings)

        // If disabling Google Sync, instantly filter out events from the UI
        if (updates.isGoogleCalendarSyncEnabled === false) {
            setCalendarData(prev => ({
                ...prev,
                events: (prev.events || []).filter(e => e.source !== 'google')
            }))
            toast.success("Google Calendar sync disabled")
        }

        try {
            const res = await fetch('/api/calendar/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSettings)
            })

            if (!res.ok) throw new Error("Failed to update settings")

            // Only show success toast if not the "instant off" case to avoid noise or if enabled
            if (updates.isGoogleCalendarSyncEnabled !== false) {
                toast.success("Settings updated")
            }

            // Always refetch to ensure consistency (backend is source of truth), 
            // but for "OFF" we already cleared the UI so the user doesn't wait.
            // For "ON", we show a loading toast if needed or just let it happen.
            if (updates.isGoogleCalendarSyncEnabled === true) {
                const loadingToast = toast.loading("Syncing with Google...")
                const calendarRes = await fetch(`/api/calendar?month=${currentDate.getMonth()}&year=${currentDate.getFullYear()}`)
                if (calendarRes.ok) {
                    const newData = await calendarRes.json()
                    setCalendarData(newData)
                    toast.success("Synced successfully", { id: loadingToast })
                } else {
                    toast.dismiss(loadingToast)
                }
            } else {
                // Background sync for consistency without UI blocker
                const calendarRes = await fetch(`/api/calendar?month=${currentDate.getMonth()}&year=${currentDate.getFullYear()}`)
                if (calendarRes.ok) {
                    const newData = await calendarRes.json()
                    setCalendarData(newData)
                }
            }

        } catch (error) {
            console.error(error)
            toast.error("Failed to save settings")
            // Revert on error
            setSyncSettings(syncSettings)
            // Ideally revert calendarData too if we filtered it, but typically a refetch is safer.
        }
    }

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 md:gap-4 px-0">
                {/* Top Row: Settings Button (right) + Title (center) */}
                <div className="relative flex items-center justify-center min-h-[40px] md:min-h-[36px]">
                    {/* Settings Button - Absolute right (only in month view) */}
                    {view === 'month' && (
                        <div className="absolute right-0 shrink-0">
                            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="icon" className="shrink-0 h-10 w-10 md:h-9 md:w-9 rounded-xl md:rounded-md border-2 shadow-sm hover:shadow-md">
                                        <Settings className="h-4 w-4" />
                                    </Button>
                                </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Calendar Settings</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-6 py-4 min-h-[400px]">
                                    <div className="flex items-center justify-between space-x-2">
                                        <div className="space-y-1">
                                            <Label className="text-base flex items-center gap-2">
                                                <PartyPopper className="h-4 w-4" />
                                                Show Holidays
                                            </Label>
                                            <p className="text-sm text-muted-foreground">
                                                Show local holidays (Israel) on the calendar.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={showHolidays}
                                            onCheckedChange={setShowHolidays}
                                        />
                                    </div>
                                    <div className="border-t" />

                                    <div className="flex items-center justify-between space-x-2">
                                        <div className="space-y-1">
                                            <Label className="text-base">Google Calendar Sync</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Sync events from your Google Calendar.
                                                {!syncSettings.isGoogleCalendarSyncEnabled && (
                                                    <span className="block text-xs text-yellow-600 mt-1">
                                                        Requires signing in with Google.
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <Switch
                                            checked={syncSettings.isGoogleCalendarSyncEnabled}
                                            onCheckedChange={(checked: boolean) => {
                                                if (checked) {
                                                    if (isGoogleLinked && hasRefreshToken) {
                                                        // If already linked and valid, just enable
                                                        handleUpdateSettings({ isGoogleCalendarSyncEnabled: true })
                                                    } else {
                                                        // Start OAuth flow (force re-auth if missing token)
                                                        handleConnectGoogle()
                                                    }
                                                } else {
                                                    handleUpdateSettings({ isGoogleCalendarSyncEnabled: false })
                                                }
                                            }}
                                        />
                                    </div>

                                    {syncSettings.isGoogleCalendarSyncEnabled && (
                                        <>


                                            <div className="space-y-2">
                                                <Label>Synced Calendars</Label>
                                                {availableCalendars.length > 0 ? (
                                                    <div className="space-y-2 border rounded-md p-3 max-h-40 overflow-y-auto">
                                                        {availableCalendars.map((cal) => (
                                                            <div key={cal.id} className="flex items-center space-x-2">
                                                                <Checkbox
                                                                    id={cal.id}
                                                                    checked={syncSettings.syncedCalendarIds?.includes(cal.id)}
                                                                    onCheckedChange={(checked) => {
                                                                        const currentIds = syncSettings.syncedCalendarIds || []
                                                                        const newIds = checked
                                                                            ? [...currentIds, cal.id]
                                                                            : currentIds.filter(id => id !== cal.id)

                                                                        // Optimistic update
                                                                        setSyncSettings(prev => ({ ...prev, syncedCalendarIds: newIds }))
                                                                        handleUpdateSettings({ syncedCalendarIds: newIds })
                                                                    }}
                                                                />
                                                                <label
                                                                    htmlFor={cal.id}
                                                                    className="text-sm cursor-pointer select-none leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                                    style={{ color: cal.foregroundColor, }} // Optional coloring
                                                                >
                                                                    {cal.summary} {cal.primary && <span className="text-xs text-muted-foreground ml-1">(Primary)</span>}
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-muted-foreground italic">
                                                        {isGoogleLinked ? "Loading calendars..." : "Connect Google Calendar to see available calendars."}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                        </DialogContent>
                    </Dialog>
                    </div>
                    )}
                    
                    {/* Back Button - Absolute left (only for day view) */}
                    {view === 'day' && (
                        <div className="absolute left-0 shrink-0">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setView('month')}
                                className="h-10 w-10 md:h-9 md:w-9"
                            >
                                <ChevronLeft className={`h-5 w-5 ${isRTL ? 'rotate-180' : ''}`} />
                            </Button>
                        </div>
                    )}

                    {/* Title - Centered absolutely */}
                    <div className="absolute left-1/2 -translate-x-1/2">
                        {view === 'month' ? (
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl md:text-3xl font-medium md:font-bold tracking-tight text-primary">
                                    {t(`months.${['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][currentDate.getMonth()]}` as 'months.january' | 'months.february' | 'months.march' | 'months.april' | 'months.may' | 'months.june' | 'months.july' | 'months.august' | 'months.september' | 'months.october' | 'months.november' | 'months.december')}
                                </h2>
                                <span className="text-xl md:text-3xl font-medium md:font-bold tracking-tight text-primary">
                                    {currentDate.getFullYear()}
                                </span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center text-center">
                                <h2 className="text-xl md:text-3xl font-medium md:font-bold tracking-tight text-primary">
                                    {t(`days.${['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][currentDate.getDay()]}` as 'days.sunday' | 'days.monday' | 'days.tuesday' | 'days.wednesday' | 'days.thursday' | 'days.friday' | 'days.saturday')}
                                </h2>
                                <div className="flex items-center gap-2 text-lg md:text-2xl font-medium md:font-bold tracking-tight text-primary">
                                    <span>{t(`months.${['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'][currentDate.getMonth()]}` as 'months.january' | 'months.february' | 'months.march' | 'months.april' | 'months.may' | 'months.june' | 'months.july' | 'months.august' | 'months.september' | 'months.october' | 'months.november' | 'months.december')}</span>
                                    <span>{currentDate.getFullYear()}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Navigation Controls - Centered below title */}
                <div className={`flex items-center justify-center gap-3 mb-4 md:mb-0 ${view === 'day' ? 'mt-4 md:mt-6' : ''}`}>
                    {/* Navigation Controls */}
                    <div className="flex items-center border-2 rounded-xl md:rounded-md bg-background shadow-sm hover:shadow-md shrink-0 overflow-hidden">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 md:h-9 md:w-9 rounded-none"
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
                            className="text-sm font-semibold border-x-2 rounded-none px-4 md:px-3 h-10 md:h-9"
                            onClick={handleToday}
                        >
                            {t('calendar.today')}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 md:h-9 md:w-9 rounded-none"
                            onClick={view === 'month'
                                ? (isRTL ? handlePrevMonth : handleNextMonth)
                                : (isRTL ? handlePrevDay : handleNextDay)
                            }
                        >
                            <ChevronRight className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-background">
                {view === 'month' ? (
                    <MonthGrid
                        date={currentDate}
                        data={{
                            ...calendarData,
                            events: [...(calendarData.events || []), ...optimisticEvents, ...holidayEvents]
                        }}
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
                        events={[...(calendarData.events || []), ...optimisticEvents, ...holidayEvents]}
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
        </div>
    )
}
