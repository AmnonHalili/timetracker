import { TimeEntry, User } from "@prisma/client"
import { eachDayOfInterval, endOfDay, isSameDay, startOfDay } from "date-fns"

export type BalanceResult = {
    totalWorkedHours: number
    totalTargetHours: number
    balance: number // +positive (extra) or -negative (missing)
    daysWorked: number
    todayWorked: number
}

export function calculateBalance(
    user: User & { timeEntries: TimeEntry[] },
    referenceDate: Date = new Date()
): BalanceResult {
    const { dailyTarget, workDays, createdAt, timeEntries } = user

    // 1. Calculate Total Worked Hours from closed entries
    // For open entries (endTime is null), we ignore them in historical totals 
    // or you could calculate 'current duration' if you want live updates.
    // Here we only sum fully completed entries or calculate duration for open ones based on 'now'.
    let totalWorkedHours = 0
    let todayWorked = 0

    timeEntries.forEach((entry) => {
        const start = new Date(entry.startTime)
        const end = entry.endTime ? new Date(entry.endTime) : referenceDate // If running, count until now

        // Safety check for weird dates
        if (end < start) return

        const durationMs = end.getTime() - start.getTime()
        const durationHours = durationMs / (1000 * 60 * 60)

        totalWorkedHours += durationHours

        if (isSameDay(start, referenceDate)) {
            todayWorked += durationHours
        }
    })

    // 2. Calculate Total Target Hours
    // Iterate from created day until yesterday (since today is still in progress)
    // OR include today in target if you want "balance so far today". 
    // Usually balance implies "past debt/surplus". Let's say we calculate up to yesterday for strict balance,
    // or full balance including today. Let's include today to show "live status".

    let totalTargetHours = 0
    let daysValid = 0

    const userStartDate = startOfDay(new Date(createdAt))
    const checkEndDate = endOfDay(referenceDate) // Include today

    // If user just started today
    if (userStartDate > checkEndDate) {
        return { totalWorkedHours, totalTargetHours: 0, balance: totalWorkedHours, daysWorked: 0, todayWorked }
    }

    const daysToCheck = eachDayOfInterval({
        start: userStartDate,
        end: checkEndDate
    })

    daysToCheck.forEach((day) => {
        // day.getDay(): 0=Sunday, 1=Monday...
        // workDays is array of ints [0, 1, 2, 3, 4] etc
        if (workDays.includes(day.getDay())) {
            totalTargetHours += dailyTarget
            daysValid++
        }
    })

    // 3. Final Balance
    const balance = totalWorkedHours - totalTargetHours

    return {
        totalWorkedHours,
        totalTargetHours,
        balance,
        daysWorked: daysValid,
        todayWorked
    }
}
