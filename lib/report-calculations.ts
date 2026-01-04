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
    formattedSessions: string
}

export type MonthlyReport = {
    days: DailyReport[]
    totalMonthlyHours: number
    totalTargetHours: number
}

export function getMonthlyReport(
    entries: TimeEntryWithBreaks[],
    workdays: Pick<Workday, 'workdayStartTime' | 'workdayEndTime'>[],
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

        // REMOVED LEGACY LOGIC THAT OVERWROTE dailyDuration
        // The new logic above calculates dailyDuration from all entries.
        // We do NOT want to overwrite it with "workday" duration anymore unless we fell back to it.

        /*
        if (workdayStartTime) {
            // ... (legacy logic removed to avoid conflict)
        }
        */



        // Check for time entries (tasks/sessions)
        const dayEntries = entries.filter(e => isSameDay(new Date(e.startTime), day))
        dayEntries.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

        const hasManualEntries = dayEntries.some(e => e.isManual)

        // Calculate total duration from ALL entries for the day (not just main workday)
        let dailyDuration = 0
        const sessionStrings: string[] = []

        dayEntries.forEach(entry => {
            const start = new Date(entry.startTime)
            const end = entry.endTime ? new Date(entry.endTime) : (isSameDay(day, today) ? new Date() : null)

            if (end) {
                // Determine duration
                let duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60)

                // Subtract breaks if supported in future/data
                if (entry.breaks) {
                    entry.breaks.forEach(b => {
                        const bStart = new Date(b.startTime).getTime()
                        const bEnd = b.endTime ? new Date(b.endTime).getTime() : Date.now()
                        duration -= (bEnd - bStart) / (1000 * 60 * 60)
                    })
                }

                dailyDuration += Math.max(0, duration) // ensure no negative duration

                // Format string: HH:mm-HH:mm
                sessionStrings.push(`${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`)
            } else {
                sessionStrings.push(`${format(start, 'HH:mm')} - ...`)
            }
        })

        // If no entries but we have a main workday (fallback for backward compatibility or simple start/end usage without tasks)
        // Actually, requirement says "show all sessions". If there are entries, we use them.
        // If there are NO entries but there IS a workday (Start Day - End Day), we should usage that as a single session.
        if (dayEntries.length === 0 && dayWorkday) {
            if (workdayStartTime) {
                const endTime = workdayEndTime || (isSameDay(day, today) ? new Date() : null)
                if (endTime) {
                    let duration = (endTime.getTime() - workdayStartTime.getTime()) / (1000 * 60 * 60)
                    dailyDuration = Math.max(0, duration)
                    sessionStrings.push(`${format(workdayStartTime, 'HH:mm')} - ${format(endTime, 'HH:mm')}`)
                } else {
                    sessionStrings.push(`${format(workdayStartTime, 'HH:mm')} - ...`)
                }
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

        const formattedSessions = sessionStrings.length > 0 ? sessionStrings.join(", ") : "-"

        return {
            date: day,
            dayName: format(day, 'EEEE'),
            isWorkDay,
            startTime: workdayStartTime, // Keep legacy or first punch? Not strictly needed for UI if we use formattedSessions
            endTime: workdayEndTime,
            totalDurationHours: dailyDuration,
            status,
            hasManualEntries,
            formattedSessions
        }
    })

    return { days, totalMonthlyHours, totalTargetHours }
}
