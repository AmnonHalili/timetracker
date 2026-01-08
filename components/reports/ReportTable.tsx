"use client"

import { useState, useMemo } from "react"
import { DailyReport } from "@/lib/report-calculations"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { format, getDay, isToday, isYesterday, startOfDay } from "date-fns"
import { he } from "date-fns/locale"
import { cn, formatHoursMinutes } from "@/lib/utils"
import { useLanguage } from "@/lib/useLanguage"
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react"

interface TimeEntry {
    id: string
    startTime: string
    endTime: string | null
    description?: string | null
    isManual?: boolean
    subtask?: { id: string; title: string } | null
    tasks?: Array<{ id: string; title: string }>
    breaks?: Array<{
        id: string
        startTime: string
        endTime: string | null
        reason?: string | null
    }>
}

interface ReportTableProps {
    days: DailyReport[]
    showWarnings?: boolean
    userId: string
}

export function ReportTable({ days, userId }: ReportTableProps) {
    const { t, isRTL, language } = useLanguage()
    const dateLocale = language === 'he' ? he : undefined
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
    const [dayEntries, setDayEntries] = useState<Record<string, { entries: TimeEntry[], loading: boolean }>>({})

    // Sort days: current day first, then yesterday, then older days in descending order
    const sortedDays = useMemo(() => {


        return [...days].sort((a, b) => {
            const dateA = startOfDay(a.date)
            const dateB = startOfDay(b.date)

            // Current day first
            if (isToday(dateA) && !isToday(dateB)) return -1
            if (!isToday(dateA) && isToday(dateB)) return 1

            // Yesterday second
            if (isYesterday(dateA) && !isYesterday(dateB) && !isToday(dateB)) return -1
            if (!isYesterday(dateA) && !isToday(dateA) && isYesterday(dateB)) return 1

            // Older days in descending order (most recent first)
            return dateB.getTime() - dateA.getTime()
        })
    }, [days])

    const getDayName = (date: Date) => {
        const dayOfWeek = getDay(date)
        const dayKeys: Array<'days.sunday' | 'days.monday' | 'days.tuesday' | 'days.wednesday' | 'days.thursday' | 'days.friday' | 'days.saturday'> = ['days.sunday', 'days.monday', 'days.tuesday', 'days.wednesday', 'days.thursday', 'days.friday', 'days.saturday']
        return t(dayKeys[dayOfWeek])
    }

    const handleDayClick = async (day: DailyReport) => {
        // Format date as YYYY-MM-DD in local timezone to avoid UTC conversion issues
        const dayKey = format(day.date, 'yyyy-MM-dd')
        const isExpanded = expandedDays.has(dayKey)

        if (isExpanded) {
            // Collapse
            setExpandedDays(prev => {
                const next = new Set(prev)
                next.delete(dayKey)
                return next
            })
        } else {
            // Expand - fetch data if not already loaded
            setExpandedDays(prev => new Set(prev).add(dayKey))

            if (!dayEntries[dayKey]) {
                setDayEntries(prev => ({ ...prev, [dayKey]: { entries: [], loading: true } }))

                try {
                    console.log(`[ReportTable] Fetching entries for date: ${dayKey}, userId: ${userId}`)
                    const response = await fetch(`/api/reports/day-details?userId=${userId}&date=${dayKey}`)
                    if (response.ok) {
                        const data = await response.json()
                        console.log(`[ReportTable] Response for ${dayKey}:`, {
                            timeEntriesCount: data.timeEntries?.length || 0,
                            entries: data.timeEntries
                        })
                        setDayEntries(prev => ({
                            ...prev,
                            [dayKey]: { entries: data.timeEntries || [], loading: false }
                        }))
                    } else {
                        const errorText = await response.text()
                        console.error(`[ReportTable] Failed to fetch day details:`, {
                            status: response.status,
                            statusText: response.statusText,
                            error: errorText
                        })
                        setDayEntries(prev => ({
                            ...prev,
                            [dayKey]: { entries: [], loading: false }
                        }))
                    }
                } catch (error) {
                    console.error("Error fetching day details:", error)
                    setDayEntries(prev => ({
                        ...prev,
                        [dayKey]: { entries: [], loading: false }
                    }))
                }
            }
        }
    }

    const getTimeRange = (start: string, end: string | null) => {
        const startTime = format(new Date(start), "HH:mm")
        if (!end) return `${startTime} - ...`
        const endTime = format(new Date(end), "HH:mm")
        return `${startTime} - ${endTime}`
    }

    const calculateDuration = (start: string, end: string | null, breaks?: Array<{ startTime: string; endTime: string | null }>) => {
        const startTime = new Date(start).getTime()
        const endTime = end ? new Date(end).getTime() : Date.now()
        let totalDuration = (endTime - startTime) / (1000 * 60 * 60)

        if (breaks) {
            breaks.forEach(breakItem => {
                const breakStart = new Date(breakItem.startTime).getTime()
                const breakEnd = breakItem.endTime ? new Date(breakItem.endTime).getTime() : Date.now()
                const breakDuration = (breakEnd - breakStart) / (1000 * 60 * 60)
                totalDuration -= breakDuration
            })
        }

        return Math.max(0, totalDuration)
    }

    return (
        <>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-2.5">
                {sortedDays.map((day) => {
                    const dayKey = format(day.date, 'yyyy-MM-dd')
                    const isExpanded = expandedDays.has(dayKey)
                    const entries = dayEntries[dayKey]?.entries || []
                    const loading = dayEntries[dayKey]?.loading || false

                    return (
                        <Card
                            key={day.date.toISOString()}
                            className={cn(
                                "border-border/60 shadow-sm cursor-pointer hover:shadow-md transition-all duration-200",
                                !day.isWorkDay && "bg-muted/30"
                            )}
                            onClick={() => handleDayClick(day)}
                        >
                            <CardContent className="p-4">
                                <div className="space-y-2.5">
                                    {/* Header: Date, Day, Total Hours */}
                                    <div className={cn(
                                        "flex items-center justify-between gap-3",
                                        isRTL && "flex-row-reverse"
                                    )}>
                                        <div className={cn("flex items-center gap-2.5 flex-1 min-w-0", isRTL && "flex-row-reverse")}>
                                            {isExpanded ? (
                                                <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                            )}
                                            <div className={cn("flex-1 min-w-0", isRTL ? "text-right" : "text-left")}>
                                                <div className="font-semibold text-sm mb-0.5">
                                                    {format(day.date, "dd/MM/yyyy", { locale: dateLocale })}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {getDayName(day.date)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={cn("flex flex-col items-end flex-shrink-0", isRTL && "items-start")}>
                                            <div className="font-mono text-base font-bold text-foreground">
                                                {formatHoursMinutes(day.totalDurationHours)}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Sessions - Full display without truncation */}
                                    {day.formattedSessions && (
                                        <div className={cn(
                                            "text-xs text-muted-foreground leading-relaxed break-words",
                                            isRTL ? "text-right" : "text-left"
                                        )}>
                                            {day.formattedSessions}
                                        </div>
                                    )}
                                </div>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <div className={cn("mt-4 pt-4 border-t border-border/60", isRTL && "text-right")}>
                                        {loading ? (
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                            </div>
                                        ) : entries.length === 0 ? (
                                            <div className="text-sm text-muted-foreground py-8 text-center">
                                                {t('reports.noTimeTracked')}
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {entries.map((entry) => {
                                                    const duration = calculateDuration(entry.startTime, entry.endTime, entry.breaks)
                                                    return (
                                                        <div
                                                            key={entry.id}
                                                            className="rounded-lg border border-border p-2.5 bg-card hover:bg-accent/50 hover:shadow-sm transition-all"
                                                        >
                                                            <div className={cn("flex flex-col gap-2", isRTL && "text-right")}>
                                                                {/* Time Range */}
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="font-mono text-sm font-semibold text-foreground">
                                                                            {getTimeRange(entry.startTime, entry.endTime)}
                                                                        </span>
                                                                    </div>
                                                                    <div className={cn("flex flex-col items-end", isRTL && "items-start")}>
                                                                        <div className="text-[9px] uppercase text-muted-foreground font-semibold tracking-wider">
                                                                            {t('timeEntries.netWork')}
                                                                        </div>
                                                                        <span className="font-mono text-sm font-bold text-primary">
                                                                            {formatHoursMinutes(duration)}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Description */}
                                                                {entry.description ? (
                                                                    <div className="text-xs font-medium text-foreground bg-muted/30 px-2 py-1 rounded">
                                                                        {entry.description}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-[10px] text-muted-foreground italic">
                                                                        {t('timeEntries.noDescription')}
                                                                    </div>
                                                                )}

                                                                {/* Tasks and Subtask */}
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {/* Tasks */}
                                                                    {entry.tasks && entry.tasks.length > 0 && (
                                                                        <>
                                                                            {entry.tasks.map((task) => (
                                                                                <span
                                                                                    key={task.id}
                                                                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20"
                                                                                >
                                                                                    {task.title}
                                                                                </span>
                                                                            ))}
                                                                        </>
                                                                    )}

                                                                    {/* Subtask */}
                                                                    {entry.subtask && (
                                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary/50 text-secondary-foreground border border-secondary/30">
                                                                            {entry.subtask.title}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Manual Entry Badge */}
                                                                {entry.isManual && (
                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-800 border border-orange-200 w-fit">
                                                                        {t('reports.manualEntry')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className={cn(isRTL ? "text-right" : "text-left", "w-[12%]")}>{t('reports.date')}</TableHead>
                        <TableHead className={cn(isRTL ? "text-right" : "text-left", "w-[18%]")}>{t('reports.day')}</TableHead>
                        <TableHead className={cn(isRTL ? "text-right" : "text-left", "w-[44%]")}>{t('reports.sessions') || "Sessions"}</TableHead>
                        <TableHead className={cn(isRTL ? "text-left" : "text-right", "w-[22%]")}>{t('reports.totalHours')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedDays.map((day) => {
                        // Format date as YYYY-MM-DD in local timezone
                        const dayKey = format(day.date, 'yyyy-MM-dd')
                        const isExpanded = expandedDays.has(dayKey)
                        const entries = dayEntries[dayKey]?.entries || []
                        const loading = dayEntries[dayKey]?.loading || false

                        return (
                            <>
                                <TableRow
                                    key={day.date.toISOString()}
                                    className={cn(
                                        !day.isWorkDay && "bg-muted/30",
                                        "cursor-pointer hover:bg-accent/50 transition-colors"
                                    )}
                                    onClick={() => handleDayClick(day)}
                                >
                                    <TableCell className={cn("font-medium", isRTL ? "text-right" : "text-left", "w-[12%]")}>
                                        <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                                            {isExpanded ? (
                                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                            )}
                                            {format(day.date, "dd/MM/yyyy", { locale: dateLocale })}
                                        </div>
                                    </TableCell>
                                    <TableCell className={cn(isRTL ? "text-right" : "text-left", "w-[18%]")}>{getDayName(day.date)}</TableCell>
                                    <TableCell className={cn(isRTL ? "text-right" : "text-left", "w-[44%]")}>
                                        {day.formattedSessions}
                                    </TableCell>
                                    <TableCell className={cn(isRTL ? "text-left" : "text-right", "font-mono", "w-[22%]")}>
                                        {formatHoursMinutes(day.totalDurationHours)}
                                    </TableCell>
                                </TableRow>

                                {/* Expanded Content */}
                                {isExpanded && (
                                    <TableRow
                                        key={`${day.date.toISOString()}-expanded`}
                                        className="bg-muted/20"
                                    >
                                        <TableCell colSpan={5} className="p-0">
                                            <div className={cn("p-3 space-y-2 transition-all duration-200 ease-in-out", isRTL && "text-right")}>
                                                {loading ? (
                                                    <div className="flex items-center justify-center py-6">
                                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                    </div>
                                                ) : entries.length === 0 ? (
                                                    <div className="text-xs text-muted-foreground py-6 text-center">
                                                        {t('reports.noTimeTracked')}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {entries.map((entry) => {
                                                            const duration = calculateDuration(entry.startTime, entry.endTime, entry.breaks)
                                                            return (
                                                                <div
                                                                    key={entry.id}
                                                                    className="rounded-lg border border-border p-2.5 bg-card hover:bg-accent/50 hover:shadow-sm transition-all"
                                                                >
                                                                    <div className={cn("flex flex-col gap-2", isRTL && "text-right")}>
                                                                        {/* Time Range */}
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="font-mono text-sm font-semibold text-foreground">
                                                                                    {getTimeRange(entry.startTime, entry.endTime)}
                                                                                </span>
                                                                            </div>
                                                                            <div className={cn("flex flex-col items-end", isRTL && "items-start")}>
                                                                                <div className="text-[9px] uppercase text-muted-foreground font-semibold tracking-wider">
                                                                                    {t('timeEntries.netWork')}
                                                                                </div>
                                                                                <span className="font-mono text-sm font-bold text-primary">
                                                                                    {formatHoursMinutes(duration)}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        {/* Description */}
                                                                        {entry.description ? (
                                                                            <div className="text-xs font-medium text-foreground bg-muted/30 px-2 py-1 rounded">
                                                                                {entry.description}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-[10px] text-muted-foreground italic">
                                                                                {t('timeEntries.noDescription')}
                                                                            </div>
                                                                        )}

                                                                        {/* Tasks and Subtask */}
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            {/* Tasks */}
                                                                            {entry.tasks && entry.tasks.length > 0 && (
                                                                                <>
                                                                                    {entry.tasks.map((task) => (
                                                                                        <span
                                                                                            key={task.id}
                                                                                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20"
                                                                                        >
                                                                                            {task.title}
                                                                                        </span>
                                                                                    ))}
                                                                                </>
                                                                            )}

                                                                            {/* Subtask */}
                                                                            {entry.subtask && (
                                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary/50 text-secondary-foreground border border-secondary/30">
                                                                                    {entry.subtask.title}
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        {/* Manual Entry Badge */}
                                                                        {entry.isManual && (
                                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-800 border border-orange-200 w-fit">
                                                                                {t('reports.manualEntry')}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
        </>
    )
}

