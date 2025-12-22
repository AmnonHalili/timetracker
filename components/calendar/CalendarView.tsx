"use client"


import { MonthGrid } from "./MonthGrid"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { format, addMonths, subMonths } from "date-fns"
import { useRouter } from "next/navigation"

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
            priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
            assignees: Array<{ name: string; email: string }>;
        }>
    }
}

export function CalendarView({ initialDate, data }: CalendarViewProps) {
    const router = useRouter()
    // We can use URL params to drive the month, allowing server fetch
    // initialDate passed from server based on searchParams

    const handlePrevMonth = () => {
        const newDate = subMonths(initialDate, 1)
        updateUrl(newDate)
    }

    const handleNextMonth = () => {
        const newDate = addMonths(initialDate, 1)
        updateUrl(newDate)
    }

    const updateUrl = (date: Date) => {
        const params = new URLSearchParams(window.location.search)
        params.set("month", date.getMonth().toString())
        params.set("year", date.getFullYear().toString())
        router.push(`/calendar?${params.toString()}`)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-3xl font-bold tracking-tight">
                        {format(initialDate, "MMMM yyyy")}
                    </h2>
                    <div className="flex items-center border rounded-md bg-background shadow-sm">
                        <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="w-[1px] h-6 bg-border" />
                        <Button variant="ghost" size="icon" onClick={() => updateUrl(new Date())}>
                            <span className="text-xs font-medium">Today</span>
                        </Button>
                        <div className="w-[1px] h-6 bg-border" />
                        <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <MonthGrid date={initialDate} data={data} />
        </div>
    )
}
