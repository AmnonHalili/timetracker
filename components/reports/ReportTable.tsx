import { DailyReport } from "@/lib/report-calculations"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

import { AlertTriangle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface ReportTableProps {
    days: DailyReport[]
    showWarnings?: boolean
}

export function ReportTable({ days, showWarnings }: ReportTableProps) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Day</TableHead>
                        <TableHead>Start Time</TableHead>
                        <TableHead>End Time</TableHead>
                        <TableHead className="text-right">Total Hours</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {days.map((day) => (
                        <TableRow key={day.date.toISOString()} className={cn(!day.isWorkDay && "bg-muted/30")}>
                            <TableCell className="font-medium flex items-center gap-2">
                                {format(day.date, "dd/MM/yyyy")}
                                {showWarnings && day.hasManualEntries && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Contains manual entries</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                            </TableCell>
                            <TableCell>{day.dayName}</TableCell>
                            <TableCell>
                                {day.startTime ? format(day.startTime, "HH:mm") : "-"}
                            </TableCell>
                            <TableCell>
                                {day.endTime ? format(day.endTime, "HH:mm") : (day.startTime ? "Running..." : "-")}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                                {day.totalDurationHours > 0 ? day.totalDurationHours.toFixed(2) + "h" : "-"}
                            </TableCell>
                            <TableCell className="text-center">
                                <StatusBadge status={day.status} />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

function StatusBadge({ status }: { status: DailyReport['status'] }) {
    switch (status) {
        case 'MET':
            return <Badge className="bg-green-500 hover:bg-green-600">Target Met</Badge>
        case 'MISSED':
            return <Badge variant="destructive">Missed</Badge>
        case 'OFF':
            return <Badge variant="secondary">Off Day</Badge>
        case 'PENDING':
            return <Badge variant="outline">Pending</Badge>
    }
}
