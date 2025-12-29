import { TimeEntry, TimeBreak, Workday } from "@prisma/client"
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
}

export type MonthlyReport = {
    days: DailyReport[]
    totalMonthlyHours: number
    totalTargetHours: number
}

export function getMonthlyReport(
    entries: TimeEntryWithBreaks[],
    workdays: Workday[],
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

        // Find workday for this day (Start Day / End Day times)
        // Prefer active workday (workdayEndTime is null) over completed ones
        // If multiple workdays exist, use the most recent one (workdays are sorted desc by workdayStartTime)
        const dayWorkdays = workdays.filter(w => isSameDay(new Date(w.workdayStartTime), day))
        // First try to find active workday (not ended yet)
        const activeWorkday = dayWorkdays.find(w => !w.workdayEndTime)
        // If no active workday, use the most recent completed one (first in array since sorted desc)
        const dayWorkday = activeWorkday || dayWorkdays[0]
        
        // Get start/end times from workday (Start Day / End Day button presses)
        let workdayStartTime: Date | null = null
        let workdayEndTime: Date | null = null
        
        if (dayWorkday) {
            workdayStartTime = new Date(dayWorkday.workdayStartTime)
            // Only set endTime if workdayEndTime exists (user pressed End Day)
            workdayEndTime = dayWorkday.workdayEndTime ? new Date(dayWorkday.workdayEndTime) : null
        }

        // Calculate total duration from workday (Start Day to End Day)
        // This is the total workday duration, not the sum of task entries
        let dailyDuration = 0
        
        if (workdayStartTime) {
            // If workday hasn't ended yet (workdayEndTime is null), calculate up to now
            // Otherwise, use the workdayEndTime
            const endTime = workdayEndTime || (isSameDay(day, today) ? new Date() : null)
            
            if (endTime) {
                dailyDuration = (endTime.getTime() - workdayStartTime.getTime()) / (1000 * 60 * 60)
            }
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

        // Check for manual entries (from time entries, not workday)
        const dayEntries = entries.filter(e => isSameDay(new Date(e.startTime), day))
        const hasManualEntries = dayEntries.some(e => e.isManual)

        return {
            date: day,
            dayName: format(day, 'EEEE'),
            isWorkDay,
            startTime: workdayStartTime, // From Start Day button
            endTime: workdayEndTime, // From End Day button
            totalDurationHours: dailyDuration,
            status,
            hasManualEntries
        }
    })

    return { days, totalMonthlyHours, totalTargetHours }
}
