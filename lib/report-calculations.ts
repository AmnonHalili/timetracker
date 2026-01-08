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

        // Find ALL workdays for this day (Start Day / End Day times)
        // We want to show all sessions, not just one
        const dayWorkdays = workdays.filter(w => isSameDay(new Date(w.workdayStartTime), day))
        // Sort by start time (earliest first)
        dayWorkdays.sort((a, b) => new Date(a.workdayStartTime).getTime() - new Date(b.workdayStartTime).getTime())

        // Get start/end times from the first workday (for legacy compatibility)
        let workdayStartTime: Date | null = null
        let workdayEndTime: Date | null = null

        if (dayWorkdays.length > 0) {
            const firstWorkday = dayWorkdays[0]
            workdayStartTime = new Date(firstWorkday.workdayStartTime)
            workdayEndTime = firstWorkday.workdayEndTime ? new Date(firstWorkday.workdayEndTime) : null
        }

        // Check for time entries (for hasManualEntries flag)
        const dayEntries = entries.filter(e => isSameDay(new Date(e.startTime), day))
        dayEntries.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

        const hasManualEntries = dayEntries.some(e => e.isManual)

        // Calculate total duration from ALL workday sessions (Start Day / End Day)
        // totalDurationHours = sum of all workday session durations
        // netHours = same as totalDuration (workday sessions don't include breaks in the calculation)
        let totalDuration = 0 // Total hours from all workday sessions
        let netDuration = 0 // Net hours (same as total for workdays)

        dayWorkdays.forEach(workday => {
            const sessionStartTime = new Date(workday.workdayStartTime)
            const sessionEndTime = workday.workdayEndTime 
                ? new Date(workday.workdayEndTime) 
                : (isSameDay(day, today) ? new Date() : null)

            if (sessionEndTime) {
                const sessionDuration = (sessionEndTime.getTime() - sessionStartTime.getTime()) / (1000 * 60 * 60)
                const duration = Math.max(0, sessionDuration)
                totalDuration += duration
                netDuration += duration // For workdays, net = total (breaks are not tracked in workday sessions)
            }
        })

        // Sessions should be based on ALL Workdays (Start Day / End Day), NOT on TimeEntries
        // The formattedSessions should show all workday sessions for the day
        const sessionStrings: string[] = []
        
        dayWorkdays.forEach(workday => {
            const sessionStartTime = new Date(workday.workdayStartTime)
            const sessionEndTime = workday.workdayEndTime 
                ? new Date(workday.workdayEndTime) 
                : (isSameDay(day, today) ? new Date() : null)
            
            if (sessionEndTime) {
                sessionStrings.push(`${format(sessionStartTime, 'HH:mm')} - ${format(sessionEndTime, 'HH:mm')}`)
            } else {
                sessionStrings.push(`${format(sessionStartTime, 'HH:mm')} - ...`)
            }
        })

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
