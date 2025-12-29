"use client"

import { useState } from "react"
import { DailyReport } from "@/lib/report-calculations"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format, getDay } from "date-fns"
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
    const { t, isRTL } = useLanguage()
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())
    const [dayEntries, setDayEntries] = useState<Record<string, { entries: TimeEntry[], loading: boolean }>>({})
    
    const getDayName = (date: Date) => {
        const dayOfWeek = getDay(date)
        const dayKeys: Array<'days.sunday' | 'days.monday' | 'days.tuesday' | 'days.wednesday' | 'days.thursday' | 'days.friday' | 'days.saturday'> = ['days.sunday', 'days.monday', 'days.tuesday', 'days.wednesday', 'days.thursday', 'days.friday', 'days.saturday']
        return t(dayKeys[dayOfWeek])
    }

    const handleDayClick = async (day: DailyReport) => {
        const dayKey = day.date.toISOString().split('T')[0]
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
                    const response = await fetch(`/api/reports/day-details?userId=${userId}&date=${dayKey}`)
                    if (response.ok) {
                        const data = await response.json()
                        setDayEntries(prev => ({ 
                            ...prev, 
                            [dayKey]: { entries: data.timeEntries || [], loading: false } 
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
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className={cn(isRTL ? "text-right" : "text-left", "w-[12%]")}>{t('reports.date')}</TableHead>
                        <TableHead className={cn(isRTL ? "text-right" : "text-left", "w-[18%]")}>{t('reports.day')}</TableHead>
                        <TableHead className={cn(isRTL ? "text-right" : "text-left", "w-[22%]")}>{t('reports.startTime')}</TableHead>
                        <TableHead className={cn(isRTL ? "text-right" : "text-left", "w-[22%]")}>{t('reports.endTime')}</TableHead>
                        <TableHead className={cn(isRTL ? "text-left" : "text-right", "w-[22%]")}>{t('reports.totalHours')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {days.map((day) => {
                        const dayKey = day.date.toISOString().split('T')[0]
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
                                            {format(day.date, "dd/MM/yyyy")}
                                        </div>
                                    </TableCell>
                                    <TableCell className={cn(isRTL ? "text-right" : "text-left", "w-[18%]")}>{getDayName(day.date)}</TableCell>
                                    <TableCell className={cn(isRTL ? "text-right" : "text-left", "w-[22%]")}>
                                        {day.startTime ? format(day.startTime, "HH:mm") : "-"}
                                    </TableCell>
                                    <TableCell className={cn(isRTL ? "text-right" : "text-left", "w-[22%]")}>
                                        {day.endTime ? format(day.endTime, "HH:mm") : (day.startTime ? "---" : "-")}
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
                                            <div className={cn("p-4 space-y-3 transition-all duration-300 ease-in-out", isRTL && "text-right")}>
                                                {loading ? (
                                                    <div className="flex items-center justify-center py-8">
                                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                                    </div>
                                                ) : entries.length === 0 ? (
                                                    <div className="text-sm text-muted-foreground py-4 text-center">
                                                        {t('reports.noTaskEntries')}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {entries.map((entry) => {
                                                            const duration = calculateDuration(entry.startTime, entry.endTime, entry.breaks)
                                                            return (
                                                                <div
                                                                    key={entry.id}
                                                                    className="rounded-xl border p-4 bg-card/50 hover:bg-card hover:shadow-sm transition-all"
                                                                >
                                                                    <div className={cn("flex flex-col gap-3", isRTL && "text-right")}>
                                                                        {/* Time Range and Duration */}
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="font-mono text-sm font-medium">
                                                                                {getTimeRange(entry.startTime, entry.endTime)}
                                                                            </span>
                                                                            <span className="font-mono text-sm font-semibold text-primary">
                                                                                {formatHoursMinutes(duration)}
                                                                            </span>
                                                                        </div>

                                                                        {/* Description */}
                                                                        {entry.description && (
                                                                            <div className="text-sm text-muted-foreground">
                                                                                {entry.description}
                                                                            </div>
                                                                        )}

                                                                        {/* Tasks */}
                                                                        {entry.tasks && entry.tasks.length > 0 && (
                                                                            <div className="flex flex-wrap gap-2">
                                                                                {entry.tasks.map((task) => (
                                                                                    <span
                                                                                        key={task.id}
                                                                                        className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                                                                                    >
                                                                                        {task.title}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}

                                                                        {/* Subtask */}
                                                                        {entry.subtask && (
                                                                            <div className="flex flex-wrap gap-2">
                                                                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-secondary/50 text-secondary-foreground border border-secondary/30">
                                                                                    {entry.subtask.title}
                                                                                </span>
                                                                            </div>
                                                                        )}

                                                                        {/* Manual Entry Badge */}
                                                                        {entry.isManual && (
                                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200 w-fit">
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
    )
}

