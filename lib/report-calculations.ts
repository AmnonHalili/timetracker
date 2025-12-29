import { TimeEntry, TimeBreak } from "@prisma/client"
import { eachDayOfInterval, endOfMonth, format, isSameDay, startOfMonth, getDay } from "date-fns"

type TimeEntryWithBreaks = TimeEntry & {
    breaks?: TimeBreak[]
}

export type DailyReport = {
    date: Date
    dayName: string
    isWorkDay: boolean
    startTime: Date | null
    endTime: Date | null
    totalDurationHours: number
    status: 'MET' | 'MISSED' | 'OFF' | 'PENDING'
    hasManualEntries: boolean
    locationStatus?: string | null // "verified", "unavailable", "outside_area", "not_required"
    locationRequired?: boolean
    breaksFromLocation?: number // Number of breaks caused by leaving work area
}

export type MonthlyReport = {
    days: DailyReport[]
    totalMonthlyHours: number
    totalTargetHours: number
}

export function getMonthlyReport(
    entries: TimeEntryWithBreaks[],
    currentDate: Date,
    dailyTarget: number,
    workDays: number[],
    limitStart?: Date,
    limitEnd?: Date
): MonthlyReport {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)

    // Determine effective interval intersection
    let start = monthStart
    if (limitStart && limitStart > start) {
        start = limitStart
    }

    let end = monthEnd
    if (limitEnd && limitEnd < end) {
        end = limitEnd
    }

    // If intersection is invalid (e.g. start > end), return empty
    if (start > end) {
        return { days: [], totalMonthlyHours: 0, totalTargetHours: 0 }
    }

    const daysInMonth = eachDayOfInterval({ start, end })
    const today = new Date()
    let totalMonthlyHours = 0
    let totalTargetHours = 0

    const days: DailyReport[] = daysInMonth.map((day) => {
        const isWorkDay = workDays.includes(getDay(day))

        // Find entries for this day
        const dayEntries = entries.filter(e => isSameDay(new Date(e.startTime), day))

        let dailyDuration = 0
        let firstStart: Date | null = null
        let lastEnd: Date | null = null

        if (dayEntries.length > 0) {
            //Sort by start time
            dayEntries.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
            firstStart = new Date(dayEntries[0].startTime)

            const lastEntry = dayEntries[dayEntries.length - 1]
            lastEnd = lastEntry.endTime ? new Date(lastEntry.endTime) : null // If running, null

            dayEntries.forEach(e => {
                const start = new Date(e.startTime)
                const end = e.endTime ? new Date(e.endTime) : (isSameDay(day, today) ? new Date() : start)
                // If entry is running today, calc up to now. If running on past day (forgot to close), maybe cap at end of day? 
                // For simplicity, let's use 'now' if it's today, otherwise it's weird data (0 duration).

                const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
                dailyDuration += duration
            })
        }

        totalMonthlyHours += dailyDuration
        if (isWorkDay && day <= today) {
            totalTargetHours += dailyTarget
        }

        // Determine Status
        let status: DailyReport['status'] = 'OFF'

        if (isWorkDay) {
            if (day > today) {
                status = 'PENDING'
            } else if (dailyDuration >= dailyTarget) {
                status = 'MET'
            } else {
                status = 'MISSED'
            }
        }

        // Check for manual entries
        const hasManualEntries = dayEntries.some(e => e.isManual)

        return {
            date: day,
            dayName: format(day, 'EEEE'),
            isWorkDay,
            startTime: firstStart,
            endTime: lastEnd,
            totalDurationHours: dailyDuration,
            status,
            hasManualEntries
        }
    })

    return { days, totalMonthlyHours, totalTargetHours }
}
