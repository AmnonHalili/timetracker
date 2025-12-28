import { prisma } from "@/lib/prisma"
import { startOfDay, addHours, subDays } from "date-fns"

export interface PeakHours {
    startHour: number
    endHour: number
    averageHours: number
    confidence: number
}

export interface WorkPattern {
    mostProductiveDay: string
    leastProductiveDay: string
    averageSessionLength: number
    longestSession: number
    averageBreaksPerDay: number
}

/**
 * Calculates user's peak productivity hours based on historical data
 */
export async function calculatePeakHours(userId: string, days: number = 30): Promise<PeakHours> {
    const startDate = subDays(new Date(), days)

    const entries = await prisma.timeEntry.findMany({
        where: {
            userId,
            startTime: { gte: startDate }
        }
    })

    // Create buckets for each hour (0-23)
    const hourBuckets: number[] = new Array(24).fill(0)

    entries.forEach(entry => {
        const start = new Date(entry.startTime)
        const end = entry.endTime ? new Date(entry.endTime) : new Date()
        const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60) // hours

        const startHour = start.getHours()
        hourBuckets[startHour] += duration
    })

    // Find 3-hour window with most work
    let maxHours = 0
    let bestStart = 9 // default 9am

    for (let i = 0; i < 24; i++) {
        const windowHours = hourBuckets[i] +
            hourBuckets[(i + 1) % 24] +
            hourBuckets[(i + 2) % 24]

        if (windowHours > maxHours) {
            maxHours = windowHours
            bestStart = i
        }
    }

    const bestEnd = (bestStart + 3) % 24
    const avgHours = maxHours / 3

    // Confidence based on data amount (more data = higher confidence)
    const totalDataPoints = entries.length
    const confidence = Math.min(totalDataPoints / 30, 1) // Max 1.0 at 30+ entries

    return {
        startHour: bestStart,
        endHour: bestEnd,
        averageHours: avgHours,
        confidence
    }
}

/**
 * Calculates focus score (0-100) based on session quality
 */
export async function calculateFocusScore(userId: string, date: Date = new Date()): Promise<number> {
    const dayStart = startOfDay(date)
    const dayEnd = addHours(dayStart, 24)

    const entries = await prisma.timeEntry.findMany({
        where: {
            userId,
            startTime: {
                gte: dayStart,
                lt: dayEnd
            }
        },
        include: {
            breaks: true
        }
    })

    if (entries.length === 0) return 0

    let score = 100

    entries.forEach(entry => {
        const start = new Date(entry.startTime)
        const end = entry.endTime ? new Date(entry.endTime) : new Date()
        const minutes = (end.getTime() - start.getTime()) / (1000 * 60)

        // Penalty for very short sessions (<30 min)
        if (minutes < 30) {
            score -= 10
        }

        // Bonus for optimal session length (60-120 min)
        else if (minutes >= 60 && minutes <= 120) {
            score += 5
        }

        // Penalty for extremely long sessions without breaks (>4 hours)
        else if (minutes > 240 && entry.breaks.length === 0) {
            score -= 15
        }

        // Check break frequency
        const breakCount = entry.breaks.length
        const hoursWorked = minutes / 60

        if (hoursWorked > 2 && breakCount === 0) {
            score -= 10 // Should take breaks
        }

        if (hoursWorked > 1 && breakCount >= 2) {
            score += 5 // Good break habits
        }
    })

    return Math.max(0, Math.min(100, score))
}

/**
 * Analyzes work patterns over time
 */
export async function analyzeWorkPatterns(userId: string, days: number = 30): Promise<WorkPattern> {
    const startDate = subDays(new Date(), days)

    const entries = await prisma.timeEntry.findMany({
        where: {
            userId,
            startTime: { gte: startDate }
        },
        include: {
            breaks: true
        }
    })

    // Group by day of week
    const dayBuckets: Record<string, { hours: number; count: number; breaks: number }> = {
        'Sunday': { hours: 0, count: 0, breaks: 0 },
        'Monday': { hours: 0, count: 0, breaks: 0 },
        'Tuesday': { hours: 0, count: 0, breaks: 0 },
        'Wednesday': { hours: 0, count: 0, breaks: 0 },
        'Thursday': { hours: 0, count: 0, breaks: 0 },
        'Friday': { hours: 0, count: 0, breaks: 0 },
        'Saturday': { hours: 0, count: 0, breaks: 0 }
    }

    let totalSessionLength = 0
    let longestSession = 0
    let totalBreaks = 0
    let daysWithWork = new Set<string>()

    entries.forEach(entry => {
        const start = new Date(entry.startTime)
        const end = entry.endTime ? new Date(entry.endTime) : new Date()
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
        const minutes = hours * 60

        const dayName = start.toLocaleDateString('en-US', { weekday: 'long' })
        const dateKey = startOfDay(start).toISOString()

        dayBuckets[dayName].hours += hours
        dayBuckets[dayName].count += 1
        dayBuckets[dayName].breaks += entry.breaks.length

        totalSessionLength += minutes
        longestSession = Math.max(longestSession, minutes)
        totalBreaks += entry.breaks.length
        daysWithWork.add(dateKey)
    })

    // Find most/least productive days
    let maxDay = 'Monday'
    let minDay = 'Monday'
    let maxHours = 0
    let minHours = Infinity

    Object.entries(dayBuckets).forEach(([day, data]) => {
        if (data.hours > maxHours) {
            maxHours = data.hours
            maxDay = day
        }
        if (data.count > 0 && data.hours < minHours) {
            minHours = data.hours
            minDay = day
        }
    })

    const avgSessionLength = entries.length > 0 ? totalSessionLength / entries.length : 0
    const avgBreaksPerDay = daysWithWork.size > 0 ? totalBreaks / daysWithWork.size : 0

    return {
        mostProductiveDay: maxDay,
        leastProductiveDay: minDay,
        averageSessionLength: Math.round(avgSessionLength),
        longestSession: Math.round(longestSession),
        averageBreaksPerDay
    }
}

/**
 * Calculates efficiency score based on tasks completed vs time spent
 */
export async function calculateEfficiencyScore(userId: string, date: Date = new Date()): Promise<number> {
    const dayStart = startOfDay(date)
    const dayEnd = addHours(dayStart, 24)

    // Get time entries for the day
    const entries = await prisma.timeEntry.findMany({
        where: {
            userId,
            startTime: {
                gte: dayStart,
                lt: dayEnd
            }
        }
    })

    // Get tasks completed on this day
    const tasksCompleted = await prisma.task.count({
        where: {
            assignees: {
                some: { id: userId }
            },
            updatedAt: {
                gte: dayStart,
                lt: dayEnd
            },
            status: 'DONE'
        }
    })

    const totalHours = entries.reduce((sum, entry) => {
        const start = new Date(entry.startTime)
        const end = entry.endTime ? new Date(entry.endTime) : new Date()
        return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    }, 0)

    if (totalHours === 0) return 0

    // Base score: tasks per hour * 20 (max around 100 for 5 tasks/day at 8 hours = 0.625 tasks/hour)
    const tasksPerHour = tasksCompleted / totalHours
    let score = tasksPerHour * 160 // Adjusted multiplier

    // Bonus for completing any tasks
    if (tasksCompleted > 0) score += 10

    // Bonus for high task completion (>5 tasks)
    if (tasksCompleted > 5) score += 20

    return Math.max(0, Math.min(100, score))
}
