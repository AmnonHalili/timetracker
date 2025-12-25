import { TimeEntry, User, WorkMode } from "@prisma/client"
import { eachDayOfInterval, endOfDay, isSameDay, startOfDay, isSameMonth } from "date-fns"

export type BalanceResult = {
    totalWorkedHours: number
    totalTargetHours: number
    balance: number
    daysWorked: number
    todayWorked: number
    accumulatedDeficit: number
    monthlyOvertime: number
}

// Helper type for inputs
type UserWithEntries = User & {
    timeEntries: (TimeEntry & { breaks?: { startTime: Date; endTime: Date | null }[] })[]
    project?: { workMode: WorkMode } | null
}

export function calculateBalance(
    user: UserWithEntries,
    referenceDate: Date = new Date()
): BalanceResult {
    const { dailyTarget, workDays, createdAt, timeEntries } = user
    // Prefer Project setting, fall back to User setting (legacy), default to TIME_BASED
    const workMode = user.project?.workMode || user.workMode || 'TIME_BASED'

    // If no daily target, we can't calculate meaningful targets
    const effectiveDailyTarget = dailyTarget ?? 0

    // Map duration by day
    const hoursPerDay: Record<string, number> = {}
    let totalWorkedHours = 0
    let todayWorked = 0

    timeEntries.forEach((entry) => {
        const start = new Date(entry.startTime)
        const end = entry.endTime ? new Date(entry.endTime) : referenceDate

        if (end < start) return

        let durationMs = end.getTime() - start.getTime()

        // If OUTPUT_BASED (Net Work), subtract valid breaks
        if (workMode === 'OUTPUT_BASED' && entry.breaks && entry.breaks.length > 0) {
            entry.breaks.forEach(brk => {
                const breakStart = new Date(brk.startTime)
                const breakEnd = brk.endTime ? new Date(brk.endTime) : referenceDate

                // Only subtract break if it overlaps with the entry (it should)
                // and distinct from "total duration" logic
                if (breakEnd > breakStart) {
                    durationMs -= (breakEnd.getTime() - breakStart.getTime())
                }
            })
        }

        const durationHours = Math.max(0, durationMs) / (1000 * 60 * 60) // Ensure no negative duration

        totalWorkedHours += durationHours

        const dayKey = startOfDay(start).toISOString()
        hoursPerDay[dayKey] = (hoursPerDay[dayKey] || 0) + durationHours

        if (isSameDay(start, referenceDate)) {
            todayWorked += durationHours
        }
    })

    let totalTargetHours = 0
    let daysValid = 0
    let accumulatedDeficit = 0
    let monthlyOvertime = 0

    const userStartDate = startOfDay(new Date(createdAt))
    const checkEndDate = endOfDay(referenceDate) // Include today

    if (userStartDate > checkEndDate) {
        return {
            totalWorkedHours,
            totalTargetHours: 0,
            balance: totalWorkedHours,
            daysWorked: 0,
            todayWorked,
            accumulatedDeficit: 0,
            monthlyOvertime: 0
        }
    }

    const daysToCheck = eachDayOfInterval({
        start: userStartDate,
        end: checkEndDate
    })

    daysToCheck.forEach((day) => {
        // Check if it's a valid work day
        if (workDays.includes(day.getDay())) {
            totalTargetHours += effectiveDailyTarget
            daysValid++

            const dayKey = startOfDay(day).toISOString()
            const worked = hoursPerDay[dayKey] || 0

            if (worked < effectiveDailyTarget) {
                accumulatedDeficit += (effectiveDailyTarget - worked)
            } else if (worked > effectiveDailyTarget) {
                // Only count extra if it's in the current month (per user req)
                // Wait, user said "Extra accumulates by month". 
                // Does this mean it resets every month? Likely yes.
                if (isSameMonth(day, referenceDate)) {
                    monthlyOvertime += (worked - effectiveDailyTarget)
                }
            }
        }
    })

    const balance = totalWorkedHours - totalTargetHours

    return {
        totalWorkedHours,
        totalTargetHours,
        balance, // Keeping for backward compat if needed
        daysWorked: daysValid,
        todayWorked,
        accumulatedDeficit,
        monthlyOvertime
    }
}
