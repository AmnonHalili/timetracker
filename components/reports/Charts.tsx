"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts"
import { format } from "date-fns"
import { formatHoursMinutes } from "@/lib/utils"

interface DailyReport {
    date: Date
    dayName: string
    isWorkDay: boolean
    startTime: Date | null
    endTime: Date | null
    totalDurationHours: number
    status: 'MET' | 'MISSED' | 'OFF' | 'PENDING'
    hasManualEntries: boolean
}

interface ChartsProps {
    days: DailyReport[]
}

export function Charts({ days }: ChartsProps) {
    // Transform data for chart
    // We want to show only days that are valid for display (e.g. not future days unless they have entries?)
    // Actually, showing the whole month context is good.
    const data = days.map(day => ({
        date: format(day.date, "dd/MM"),
        fullDate: format(day.date, "dd/MM/yyyy"),
        hours: Number(day.totalDurationHours.toFixed(2)),
        isWorkDay: day.isWorkDay,
        status: day.status
    }))

    // Calculate some stats
    const totalHours = data.reduce((acc, curr) => acc + curr.hours, 0)
    const averageHours = data.filter(d => d.hours > 0).length > 0
        ? totalHours / data.filter(d => d.hours > 0).length
        : 0

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
                <CardHeader>
                    <CardTitle>Daily Activity</CardTitle>
                    <CardDescription>
                        Total hours worked per day this month.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                    <div className="h-[240px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value}h`}
                                />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="flex flex-col">
                                                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                                Date
                                                            </span>
                                                            <span className="font-bold text-muted-foreground">
                                                                {label}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                                Hours
                                                            </span>
                                                            <span className="font-bold">
                                                                {payload[0].value}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        }
                                        return null
                                    }}
                                />
                                <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                                    {data.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.hours >= 9 ? "#22c55e" : entry.hours > 0 ? "#3b82f6" : "#e2e8f0"}
                                            className="transition-all hover:opacity-80"
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card className="col-span-3">
                <CardHeader>
                    <CardTitle>Overview</CardTitle>
                    <CardDescription>
                        Monthly performance statistics.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Total Hours</span>
                            <span className="text-2xl font-bold">{formatHoursMinutes(totalHours)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Average (Active Days)</span>
                            <span className="text-2xl font-bold">{formatHoursMinutes(averageHours)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Work Days</span>
                            <span className="text-2xl font-bold">{data.filter(d => d.hours > 0).length}</span>
                        </div>
                        {/* Simple visual representation using standard div bars if Pie is too much or adding Pie later */}
                        <div className="pt-4">
                            <div className="text-xs text-muted-foreground mb-2">Status Distribution</div>
                            <div className="flex h-4 w-full overflow-hidden rounded-full">
                                {(() => {
                                    const met = data.filter(d => d.hours >= 9).length
                                    const worked = data.filter(d => d.hours > 0 && d.hours < 9).length
                                    const total = data.length || 1

                                    return (
                                        <>
                                            <div style={{ width: `${(met / total) * 100}%` }} className="bg-green-500" title="Met Target" />
                                            <div style={{ width: `${(worked / total) * 100}%` }} className="bg-blue-500" title="Worked" />
                                            <div className="bg-muted flex-1" title="Off/Missed" />
                                        </>
                                    )
                                })()}
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
                                <span>Target Met</span>
                                <span>Partial</span>
                                <span>Off</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
