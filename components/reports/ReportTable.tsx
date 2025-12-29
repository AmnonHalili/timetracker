"use client"

import { DailyReport } from "@/lib/report-calculations"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format, getDay } from "date-fns"
import { cn, formatHoursMinutes } from "@/lib/utils"
import { useLanguage } from "@/lib/useLanguage"

interface ReportTableProps {
    days: DailyReport[]
    showWarnings?: boolean
}

export function ReportTable({ days }: ReportTableProps) {
    const { t, isRTL } = useLanguage()
    
    const getDayName = (date: Date) => {
        const dayOfWeek = getDay(date)
        const dayKeys: Array<'days.sunday' | 'days.monday' | 'days.tuesday' | 'days.wednesday' | 'days.thursday' | 'days.friday' | 'days.saturday'> = ['days.sunday', 'days.monday', 'days.tuesday', 'days.wednesday', 'days.thursday', 'days.friday', 'days.saturday']
        return t(dayKeys[dayOfWeek])
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
                    {days.map((day) => (
                        <TableRow key={day.date.toISOString()} className={cn(!day.isWorkDay && "bg-muted/30")}>
                            <TableCell className={cn("font-medium", isRTL ? "text-right" : "text-left", "w-[15%]")}>
                                {format(day.date, "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell className={cn(isRTL ? "text-right" : "text-left", "w-[21.25%]")}>{getDayName(day.date)}</TableCell>
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
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

