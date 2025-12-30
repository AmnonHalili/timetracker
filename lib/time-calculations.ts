import { TimeEntry, User, WorkMode } from "@prisma/client"
import { eachDayOfInterval, endOfDay, isSameDay, startOfDay, startOfMonth, isSameMonth } from "date-fns"

export type BalanceResult = {
    totalWorkedHours: number
    totalTargetHours: number
    balance: number
    daysWorked: number
    todayWorked: number
    // Legacy fields mapped for compatibility or specific UI needs
    accumulatedDeficit: number // Will map to "Remaining" (if negative balance)
    monthlyOvertime: number    // Will map to "Extra" (if positive balance)
    monthlyBalance: number     // The raw net balance
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
    const { dailyTarget, workDays, timeEntries } = user
    // Prefer Project setting, fall back to User setting (legacy), default to TIME_BASED
    const workMode = user.project?.workMode || user.workMode || 'TIME_BASED'

    // If no daily target, we can't calculate meaningful targets
    const effectiveDailyTarget = dailyTarget ?? 0

    // 1. Determine Timeframe: Start of current Month -> Reference Date (Today)
    const monthStart = startOfMonth(referenceDate)
    const checkEndDate = endOfDay(referenceDate) // Include today fully (for target calc)

    // 2. Calculate Actual Hours (Work performed in this month)
    let totalWorkedHours = 0
    let todayWorked = 0

    timeEntries.forEach((entry) => {
        const start = new Date(entry.startTime)
        // Only count entries that STARTED in this month (or overlap? usually safe to assume start date determines month attribution)
        // Strict consistency: Include any time worked *during* this month.
        // Simplification: Filter by start time >= monthStart.
        if (start < monthStart) return

        const end = entry.endTime ? new Date(entry.endTime) : referenceDate

        if (end < start) return

        let durationMs = end.getTime() - start.getTime()

        // If OUTPUT_BASED (Net Work), subtract valid breaks
        if (workMode === 'OUTPUT_BASED' && entry.breaks && entry.breaks.length > 0) {
            entry.breaks.forEach(brk => {
                const breakStart = new Date(brk.startTime)
                const breakEnd = brk.endTime ? new Date(brk.endTime) : referenceDate

                if (breakEnd > breakStart) {
                    durationMs -= (breakEnd.getTime() - breakStart.getTime())
                }
            })
        }

        const durationHours = Math.max(0, durationMs) / (1000 * 60 * 60)

        totalWorkedHours += durationHours

        if (isSameDay(start, referenceDate)) {
            todayWorked += durationHours
        }
    })

    // 3. Calculate Target Hours (Sum of daily targets for valid workdays in this month, so far)
    let totalTargetHours = 0
    let daysValid = 0

    const userStartDate = startOfDay(new Date(user.createdAt))
    // Start from the later of: 1st of Month OR User Creation Date
    let effectiveStartDate = monthStart
    if (userStartDate > monthStart) {
        effectiveStartDate = userStartDate
    }

    // Safety check: if effective start date is in the future relative to reference date (shouldn't happen for past/present report, but good for safety)
    if (effectiveStartDate <= referenceDate) {
        // We iterate from effectiveStartDate to today (inclusive)
        const daysToCheck = eachDayOfInterval({
            start: effectiveStartDate,
            end: referenceDate
        })

        daysToCheck.forEach((day) => {
            if (workDays.includes(day.getDay())) {
                totalTargetHours += effectiveDailyTarget
                daysValid++
            }
        })
    }



    // 4. Calculate Net Balance
    // Balance = Monthly_Actual - Monthly_Target
    const monthlyBalance = totalWorkedHours - totalTargetHours

    // 5. Map to Display Rules
    // If Balance > 0: Extra = Balance, Remaining = 0
    // If Balance < 0: Remaining = abs(Balance), Extra = 0
    let accumulatedDeficit = 0 // Remaining
    let monthlyOvertime = 0    // Extra

    if (monthlyBalance > 0) {
        monthlyOvertime = monthlyBalance
        accumulatedDeficit = 0
    } else if (monthlyBalance < 0) {
        monthlyOvertime = 0
        accumulatedDeficit = Math.abs(monthlyBalance)
    }

    return {
        totalWorkedHours,
        totalTargetHours,
        balance: monthlyBalance,
        daysWorked: daysValid,
        todayWorked,
        accumulatedDeficit,
        monthlyOvertime,
        monthlyBalance
    }
}
