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
    totalDurationHours: number // Total hours including breaks (sum of all session durations)
    netHours: number // Net work hours excluding breaks (sum of all session durations minus breaks)
    status: 'MET' | 'MISSED' | 'OFF' | 'PENDING'
    hasManualEntries: boolean
    formattedSessions: string
}

export type MonthlyReport = {
    days: DailyReport[]
    totalMonthlyHours: number
    totalTargetHours: number
}

// Helper function to get hours for a specific day of week (0-6)
function getHoursForDay(
    weeklyHours: Record<string, number> | null | undefined,
    workDays: number[],
    dailyTarget: number,
    dayOfWeek: number
): number {
    // If weeklyHours exists, use it
    if (weeklyHours && typeof weeklyHours === 'object') {
        const hours = weeklyHours[dayOfWeek.toString()]
        if (typeof hours === 'number' && hours >= 0) {
            return hours
        }
    }
    
    // Fallback to legacy format: workDays + dailyTarget
    if (workDays && workDays.includes(dayOfWeek)) {
        return dailyTarget
    }
    
    return 0
}

export function getMonthlyReport(
    entries: TimeEntryWithBreaks[],
    workdays: Pick<Workday, 'workdayStartTime' | 'workdayEndTime'>[],
    currentDate: Date,
    dailyTarget: number,
    workDays: number[],
    limitStart?: Date,
    limitEnd?: Date,
    weeklyHours?: Record<string, number> | null
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
        const dayOfWeek = getDay(day)
        const hoursForDay = getHoursForDay(weeklyHours, workDays, dailyTarget, dayOfWeek)
        const isWorkDay = hoursForDay > 0

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

        // Check for time entries (for calculating totalDurationHours and netHours)
        const dayEntries = entries.filter(e => isSameDay(new Date(e.startTime), day))
        dayEntries.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

        const hasManualEntries = dayEntries.some(e => e.isManual)

        // Calculate total duration from ALL entries for the day (for totalDurationHours and netHours)
        // totalDurationHours = sum of all session durations (including breaks)
        // netHours = sum of all session durations (excluding breaks)
        let totalDuration = 0 // Total hours including breaks
        let netDuration = 0 // Net hours excluding breaks

        dayEntries.forEach(entry => {
            const start = new Date(entry.startTime)
            const end = entry.endTime ? new Date(entry.endTime) : (isSameDay(day, today) ? new Date() : null)

            if (end) {
                // Total duration (including breaks)
                const totalSessionDuration = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
                totalDuration += Math.max(0, totalSessionDuration)

                // Net duration (excluding breaks)
                let netSessionDuration = totalSessionDuration
                if (entry.breaks) {
                    entry.breaks.forEach(b => {
                        const bStart = new Date(b.startTime).getTime()
                        const bEnd = b.endTime ? new Date(b.endTime).getTime() : Date.now()
                        netSessionDuration -= (bEnd - bStart) / (1000 * 60 * 60)
                    })
                }
                netDuration += Math.max(0, netSessionDuration) // ensure no negative duration
            }
        })

        // Sessions should be based on Workday (Start Day / End Day), NOT on TimeEntries
        // The formattedSessions should show the workday times, not the timer times
        const sessionStrings: string[] = []
        
        if (dayWorkday && workdayStartTime) {
            // Use workday times for sessions display
            const endTime = workdayEndTime || (isSameDay(day, today) ? new Date() : null)
            if (endTime) {
                sessionStrings.push(`${format(workdayStartTime, 'HH:mm')} - ${format(endTime, 'HH:mm')}`)
            } else {
                sessionStrings.push(`${format(workdayStartTime, 'HH:mm')} - ...`)
            }
        }

        totalMonthlyHours += netDuration // Use net hours for monthly total
        if (isWorkDay && day <= today) {
            totalTargetHours += hoursForDay
        }

        // Determine Status (based on net hours)
        let status: DailyReport['status'] = 'OFF'

        if (isWorkDay) {
            if (day > today) {
                status = 'PENDING'
            } else if (netDuration >= hoursForDay) {
                status = 'MET'
            } else {
                status = 'MISSED'
            }
        }

        const formattedSessions = sessionStrings.length > 0 ? sessionStrings.join(", ") : "-"

        return {
            date: day,
            dayName: format(day, 'EEEE'),
            isWorkDay,
            startTime: workdayStartTime, // Keep legacy or first punch? Not strictly needed for UI if we use formattedSessions
            endTime: workdayEndTime,
            totalDurationHours: totalDuration, // Total hours including breaks
            netHours: netDuration, // Net hours excluding breaks
            status,
            hasManualEntries,
            formattedSessions
        }
    })

    return { days, totalMonthlyHours, totalTargetHours }
}
