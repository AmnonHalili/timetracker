import { prisma } from "@/lib/prisma"
import { startOfWeek, endOfWeek, startOfDay, addHours, subDays, differenceInDays } from "date-fns"

export type BurnoutRiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface BurnoutFactor {
    type: string
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    message: string
    value?: number
}

export interface BurnoutAssessment {
    riskLevel: BurnoutRiskLevel
    score: number
    factors: BurnoutFactor[]
    recommendations: string[]
}

interface WeeklyData {
    totalHours: number
    weekendWork: number
    lateWorkHours: number
    avgDailyHours: number
}

function isWeekend(date: Date): boolean {
    const day = date.getDay()
    return day === 6 || day === 0
}

function isLateNight(date: Date): boolean {
    const hour = date.getHours()
    return hour >= 20 || hour < 6
}

async function getWeeklyData(userId: string, referenceDate: Date = new Date()): Promise<WeeklyData> {
    const weekStart = startOfWeek(referenceDate)
    const weekEnd = endOfWeek(referenceDate)

    const entries = await prisma.timeEntry.findMany({
        where: {
            userId,
            startTime: {
                gte: weekStart,
                lte: weekEnd
            }
        }
    })

    let totalHours = 0
    let weekendWork = 0
    let lateWorkHours = 0

    entries.forEach(entry => {
        const start = new Date(entry.startTime)
        const end = entry.endTime ? new Date(entry.endTime) : new Date()
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)

        totalHours += hours

        if (isWeekend(start)) {
            weekendWork += hours
        }

        if (isLateNight(start)) {
            lateWorkHours += hours
        }
    })

    const daysInWeek = 7

    return {
        totalHours,
        weekendWork,
        lateWorkHours,
        avgDailyHours: totalHours / daysInWeek
    }
}

async function getConsecutiveDays(userId: string): Promise<number> {
    const entries = await prisma.timeEntry.findMany({
        where: { userId },
        orderBy: { startTime: 'desc' },
        take: 30
    })

    if (entries.length === 0) return 0

    const workDates = new Set<string>()
    entries.forEach(entry => {
        const dateKey = startOfDay(new Date(entry.startTime)).toISOString()
        workDates.add(dateKey)
    })

    const sortedDates = Array.from(workDates)
        .map(d => new Date(d))
        .sort((a, b) => b.getTime() - a.getTime())

    let consecutive = 1

    for (let i = 0; i < sortedDates.length - 1; i++) {
        const diff = differenceInDays(sortedDates[i], sortedDates[i + 1])
        if (diff === 1) {
            consecutive++
        } else {
            break
        }
    }

    return consecutive
}

async function getTodayOvertimeHours(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { dailyTarget: true }
    })

    if (!user?.dailyTarget) return 0

    const today = startOfDay(new Date())
    const tomorrow = addHours(today, 24)

    const entries = await prisma.timeEntry.findMany({
        where: {
            userId,
            startTime: {
                gte: today,
                lt: tomorrow
            }
        }
    })

    const totalHours = entries.reduce((sum, entry) => {
        const start = new Date(entry.startTime)
        const end = entry.endTime ? new Date(entry.endTime) : new Date()
        return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    }, 0)

    return Math.max(0, totalHours - user.dailyTarget)
}

async function getTodayBreakCount(userId: string): Promise<number> {
    const today = startOfDay(new Date())
    const tomorrow = addHours(today, 24)

    const entries = await prisma.timeEntry.findMany({
        where: {
            userId,
            startTime: {
                gte: today,
                lt: tomorrow
            }
        },
        select: {
            id: true,
            userId: true,
            startTime: true,
            endTime: true,
            description: true,
            isManual: true,
            createdAt: true,
            updatedAt: true,
            subtaskId: true,
            locationRequired: true,
            startLocationLat: true,
            startLocationLng: true,
            startLocationVerified: true,
            endLocationLat: true,
            endLocationLng: true,
            endLocationVerified: true,
            locationStatus: true,
            breaks: true
        }
    })

    return entries.reduce((sum, entry) => sum + (entry.breaks?.length || 0), 0)
}

async function calculateProductivityTrend(userId: string, days: number = 14): Promise<number> {
    const snapshots = await prisma.analyticsSnapshot.findMany({
        where: {
            userId,
            date: {
                gte: subDays(new Date(), days)
            }
        },
        orderBy: { date: 'asc' }
    })

    if (snapshots.length < 7) return 0

    const midpoint = Math.floor(snapshots.length / 2)
    const firstHalf = snapshots.slice(0, midpoint)
    const secondHalf = snapshots.slice(midpoint)

    const avgFirst = firstHalf.reduce((sum, s) => sum + s.focusScore, 0) / firstHalf.length
    const avgSecond = secondHalf.reduce((sum, s) => sum + s.focusScore, 0) / secondHalf.length

    return avgFirst > 0 ? (avgSecond - avgFirst) / avgFirst : 0
}

function generateBurnoutRecommendations(factors: BurnoutFactor[]): string[] {
    const recommendations: string[] = []

    factors.forEach(factor => {
        switch (factor.type) {
            case 'EXCESSIVE_HOURS':
                recommendations.push('Take at least one full day off this week')
                recommendations.push('Delegate or postpone 2-3 non-urgent tasks')
                break
            case 'HIGH_HOURS':
                recommendations.push('Review your workload and prioritize essential tasks')
                break
            case 'DAILY_OVERTIME':
                recommendations.push('Set a hard stop time for your workday')
                break
            case 'LATE_WORK':
                recommendations.push('Avoid working after 8 PM to maintain work-life balance')
                break
            case 'WEEKEND_WORK':
                recommendations.push('Keep weekends work-free for recovery')
                break
            case 'NO_REST_DAYS':
                recommendations.push('Schedule at least 1-2 rest days per week')
                break
            case 'INSUFFICIENT_BREAKS':
                recommendations.push('Take a 10-15 minute break every 90 minutes')
                break
            case 'DECLINING_PERFORMANCE':
                recommendations.push('This may be a sign of fatigue - consider taking time off')
                break
        }
    })

    const criticalFactors = factors.filter(f => f.severity === 'CRITICAL')
    if (criticalFactors.length > 0) {
        recommendations.unshift('⚠️ Immediate action required - speak with your manager')
        recommendations.unshift('Consider taking 2-3 days off to recover')
    }

    return Array.from(new Set(recommendations))
}

export async function detectBurnoutRisk(userId: string): Promise<BurnoutAssessment> {
    const weeklyData = await getWeeklyData(userId)
    const consecutiveDays = await getConsecutiveDays(userId)
    const todayOvertime = await getTodayOvertimeHours(userId)
    const todayBreaks = await getTodayBreakCount(userId)
    const productivityTrend = await calculateProductivityTrend(userId)

    const factors: BurnoutFactor[] = []
    let score = 0

    if (weeklyData.totalHours > 55) {
        factors.push({
            type: 'EXCESSIVE_HOURS',
            severity: 'CRITICAL',
            message: `Working ${weeklyData.totalHours.toFixed(1)} hours this week`,
            value: weeklyData.totalHours
        })
        score += 30
    } else if (weeklyData.totalHours > 50) {
        factors.push({
            type: 'EXCESSIVE_HOURS',
            severity: 'HIGH',
            message: `Working ${weeklyData.totalHours.toFixed(1)} hours this week`,
            value: weeklyData.totalHours
        })
        score += 25
    } else if (weeklyData.totalHours > 45) {
        factors.push({
            type: 'HIGH_HOURS',
            severity: 'MEDIUM',
            message: `Working ${weeklyData.totalHours.toFixed(1)} hours this week`,
            value: weeklyData.totalHours
        })
        score += 15
    }

    if (todayOvertime > 4) {
        factors.push({
            type: 'DAILY_OVERTIME',
            severity: 'HIGH',
            message: `${todayOvertime.toFixed(1)} hours overtime today`
        })
        score += 20
    } else if (todayOvertime > 2) {
        factors.push({
            type: 'DAILY_OVERTIME',
            severity: 'MEDIUM',
            message: `${todayOvertime.toFixed(1)} hours overtime today`
        })
        score += 10
    }

    if (weeklyData.lateWorkHours > 10) {
        factors.push({
            type: 'LATE_WORK',
            severity: 'HIGH',
            message: `${weeklyData.lateWorkHours.toFixed(1)} hours of late-night work this week`
        })
        score += 20
    } else if (weeklyData.lateWorkHours > 5) {
        factors.push({
            type: 'LATE_WORK',
            severity: 'MEDIUM',
            message: `${weeklyData.lateWorkHours.toFixed(1)} hours of late-night work this week`
        })
        score += 15
    }

    if (weeklyData.weekendWork > 8) {
        factors.push({
            type: 'WEEKEND_WORK',
            severity: 'HIGH',
            message: `${weeklyData.weekendWork.toFixed(1)} hours worked on weekend`
        })
        score += 25
    } else if (weeklyData.weekendWork > 3) {
        factors.push({
            type: 'WEEKEND_WORK',
            severity: 'MEDIUM',
            message: `${weeklyData.weekendWork.toFixed(1)} hours worked on weekend`
        })
        score += 15
    }

    if (consecutiveDays >= 10) {
        factors.push({
            type: 'NO_REST_DAYS',
            severity: 'CRITICAL',
            message: `${consecutiveDays} consecutive work days`,
            value: consecutiveDays
        })
        score += 35
    } else if (consecutiveDays >= 7) {
        factors.push({
            type: 'NO_REST_DAYS',
            severity: 'HIGH',
            message: `${consecutiveDays} consecutive work days`,
            value: consecutiveDays
        })
        score += 25
    }

    if (todayBreaks < 1 && weeklyData.avgDailyHours > 6) {
        factors.push({
            type: 'INSUFFICIENT_BREAKS',
            severity: 'MEDIUM',
            message: `Only ${todayBreaks} breaks taken today`
        })
        score += 15
    }

    if (productivityTrend < -0.20) {
        factors.push({
            type: 'DECLINING_PERFORMANCE',
            severity: 'HIGH',
            message: `Productivity declined by ${Math.abs(productivityTrend * 100).toFixed(0)}%`
        })
        score += 25
    } else if (productivityTrend < -0.10) {
        factors.push({
            type: 'DECLINING_PERFORMANCE',
            severity: 'MEDIUM',
            message: `Productivity declined by ${Math.abs(productivityTrend * 100).toFixed(0)}%`
        })
        score += 15
    }

    let riskLevel: BurnoutRiskLevel = 'NONE'
    if (score >= 80) riskLevel = 'CRITICAL'
    else if (score >= 60) riskLevel = 'HIGH'
    else if (score >= 40) riskLevel = 'MEDIUM'
    else if (score >= 20) riskLevel = 'LOW'

    return {
        riskLevel,
        score,
        factors,
        recommendations: generateBurnoutRecommendations(factors)
    }
}

export async function hasBurnoutRisk(userId: string): Promise<boolean> {
    const assessment = await detectBurnoutRisk(userId)
    return assessment.riskLevel !== 'NONE'
}

export async function getTeamBurnoutStatus(userIds: string[]): Promise<Map<string, BurnoutAssessment>> {
    const results = new Map<string, BurnoutAssessment>()

    await Promise.all(
        userIds.map(async (userId) => {
            const assessment = await detectBurnoutRisk(userId)
            if (assessment.riskLevel !== 'NONE') {
                results.set(userId, assessment)
            }
        })
    )

    return results
}
