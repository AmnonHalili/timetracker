"use client"

import { DailyReport } from "@/lib/report-calculations"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format, getDay } from "date-fns"
import { cn, formatHoursMinutes } from "@/lib/utils"
import { useLanguage } from "@/lib/useLanguage"
import { CheckCircle2, AlertCircle, XCircle, MapPin, Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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

    const getLocationStatusIcon = (day: DailyReport) => {
        if (!day.locationRequired) {
            return (
                <Tooltip>
                    <TooltipTrigger>
                        <MapPin className="h-4 w-4 text-blue-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Location not required</p>
                    </TooltipContent>
                </Tooltip>
            )
        }

        switch (day.locationStatus) {
            case "verified":
                return (
                    <Tooltip>
                        <TooltipTrigger>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Location verified</p>
                        </TooltipContent>
                    </Tooltip>
                )
            case "unavailable":
                return (
                    <Tooltip>
                        <TooltipTrigger>
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Location unavailable</p>
                        </TooltipContent>
                    </Tooltip>
                )
            case "outside_area":
                return (
                    <Tooltip>
                        <TooltipTrigger>
                            <XCircle className="h-4 w-4 text-red-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Outside work area</p>
                        </TooltipContent>
                    </Tooltip>
                )
            default:
                return null
        }
    }
    
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className={cn(isRTL ? "text-right" : "text-left", "w-[12%]")}>{t('reports.date')}</TableHead>
                        <TableHead className={cn(isRTL ? "text-right" : "text-left", "w-[18%]")}>{t('reports.day')}</TableHead>
                        <TableHead className={cn(isRTL ? "text-right" : "text-left", "w-[18%]")}>{t('reports.startTime')}</TableHead>
                        <TableHead className={cn(isRTL ? "text-right" : "text-left", "w-[18%]")}>{t('reports.endTime')}</TableHead>
                        <TableHead className={cn(isRTL ? "text-left" : "text-right", "w-[18%]")}>{t('reports.totalHours')}</TableHead>
                        <TableHead className={cn("text-center", "w-[8%]")}>Location</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {days.map((day) => (
                        <TableRow key={day.date.toISOString()} className={cn(!day.isWorkDay && "bg-muted/30")}>
                            <TableCell className={cn("font-medium", isRTL ? "text-right" : "text-left", "w-[15%]")}>
                                {format(day.date, "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell className={cn(isRTL ? "text-right" : "text-left", "w-[21.25%]")}>{getDayName(day.date)}</TableCell>
                            <TableCell className={cn(isRTL ? "text-right" : "text-left", "w-[21.25%]")}>
                                {day.startTime ? format(day.startTime, "HH:mm") : "-"}
                            </TableCell>
                            <TableCell className={cn(isRTL ? "text-right" : "text-left", "w-[21.25%]")}>
                                {day.endTime ? format(day.endTime, "HH:mm") : (day.startTime ? "Running..." : "-")}
                            </TableCell>
                            <TableCell className={cn(isRTL ? "text-left" : "text-right", "font-mono", "w-[18%]")}>
                                {formatHoursMinutes(day.totalDurationHours)}
                            </TableCell>
                            <TableCell className={cn("text-center", "w-[8%]")}>
                                <TooltipProvider>
                                    {getLocationStatusIcon(day)}
                                    {day.breaksFromLocation && day.breaksFromLocation > 0 && (
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <Info className="h-3 w-3 text-orange-500 ml-1" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{day.breaksFromLocation} break(s) from leaving work area</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                                </TooltipProvider>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

