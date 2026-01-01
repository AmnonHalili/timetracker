import { TimeEntry, User, WorkMode, Workday } from "@prisma/client"
import { eachDayOfInterval, isSameDay, startOfDay, startOfMonth } from "date-fns"

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
    referenceDate: Date = new Date(),
    workdays: Pick<Workday, 'workdayStartTime' | 'workdayEndTime'>[] = []
): BalanceResult {
    const { dailyTarget, workDays } = user
    // Prefer Project setting, fall back to User setting (legacy), default to TIME_BASED
    const workMode = user.project?.workMode || user.workMode || 'TIME_BASED'

    // If no daily target, we can't calculate meaningful targets
    const effectiveDailyTarget = dailyTarget ?? 0

    // 1. Determine Timeframe: Start of current Month -> Reference Date (Today)
    const monthStart = startOfMonth(referenceDate)

    // 2. Calculate Actual Hours (Work performed in this month) - Based on workdays (Start Day / End Day)
    let totalWorkedHours = 0
    let todayWorked = 0

    // Group workdays by day to handle multiple workdays per day (prefer active ones)
    const workdaysByDay = new Map<string, Pick<Workday, 'workdayStartTime' | 'workdayEndTime'>[]>()
    
    workdays.forEach((workday) => {
        const workdayStart = new Date(workday.workdayStartTime)
        // Only count workdays that started in this month
        if (workdayStart < monthStart) return
        
        const dayKey = startOfDay(workdayStart).toISOString()
        if (!workdaysByDay.has(dayKey)) {
            workdaysByDay.set(dayKey, [])
        }
        workdaysByDay.get(dayKey)!.push(workday)
    })

    // Calculate hours from workdays
    workdaysByDay.forEach((dayWorkdays, dayKey) => {
        // Prefer active workday (workdayEndTime is null) over completed ones
        const activeWorkday = dayWorkdays.find(w => !w.workdayEndTime)
        const dayWorkday = activeWorkday || dayWorkdays[0] // Use first if no active one (should be sorted desc)
        
        const workdayStartTime = new Date(dayWorkday.workdayStartTime)
        const workdayEndTime = dayWorkday.workdayEndTime ? new Date(dayWorkday.workdayEndTime) : null
        
        // Calculate duration from workday (Start Day to End Day, or current time if active)
        if (workdayStartTime) {
            const endTime = workdayEndTime || (isSameDay(workdayStartTime, referenceDate) ? referenceDate : null)
            
            if (endTime) {
                const durationHours = (endTime.getTime() - workdayStartTime.getTime()) / (1000 * 60 * 60)
                totalWorkedHours += Math.max(0, durationHours)
                
                if (isSameDay(workdayStartTime, referenceDate)) {
                    todayWorked += Math.max(0, durationHours)
                }
            }
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
