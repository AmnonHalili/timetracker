import { DailyReport } from "@/lib/report-calculations"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

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
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {days.map((day) => (
                        <TableRow key={day.date.toISOString()} className={cn(!day.isWorkDay && "bg-muted/30")}>
                            <TableCell className="font-medium">
                                {format(day.date, "dd/MM/yyyy")}
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
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

