import { prisma } from "@/lib/prisma"
import { startOfDay, subDays, addHours, min, differenceInMinutes } from "date-fns"

export interface PeakHours {
    startHour: number
    endHour: number
    averageHours: number
    confidence: number
}

export interface WorkPatterns {
    averageSessionLength: number // minutes
    longestSession: number // minutes
    breaksTaken: number
    mostProductiveDay: string
    leastProductiveDay: string
    averageBreaksPerDay: number
}

/**
 * Calculates user's most productive hours based on historical data
 * Returns 2-3 hour window with highest activity
 */
export async function calculatePeakHours(
    userId: string,
    days: number = 30
): Promise<PeakHours> {
    const startDate = subDays(new Date(), days)

    const entries = await prisma.timeEntry.findMany({
        where: {
            userId,
            startTime: { gte: startDate }
        },
        orderBy: { startTime: 'asc' }
    })

    if (entries.length === 0) {
        return {
            startHour: 9,
            endHour: 12,
            averageHours: 0,
            confidence: 0
        }
    }

    // Create hour buckets (0-23)
    const hourBuckets: number[] = new Array(24).fill(0)

    // Count productive hours per hour of day
    entries.forEach(entry => {
        let start = new Date(entry.startTime)
        const end = entry.endTime ? new Date(entry.endTime) : new Date()

        // Iterate through each hour in the entry
        while (start < end) {
            const hour = start.getHours()
            const nextHour = addHours(start, 1)
            const endOfCurrentHour = min([nextHour, end])

            const duration = (endOfCurrentHour.getTime() - start.getTime()) / (1000 * 60 * 60)
            hourBuckets[hour] += duration

            start = nextHour
        }
    })

    // Find 3 consecutive hours with max total
    let maxSum = 0
    let peakStart = 9 // default

    for (let i = 0; i < 21; i++) { // 0-20 to allow for 3-hour window
        const sum3h = hourBuckets[i] + hourBuckets[i + 1] + hourBuckets[i + 2]

        if (sum3h > maxSum) {
            maxSum = sum3h
            peakStart = i
        }
    }

    // Calculate confidence (0-1) based on how much work happens in peak vs other hours
    const totalHours = hourBuckets.reduce((a, b) => a + b, 0)
    const peakHours = hourBuckets[peakStart] + hourBuckets[peakStart + 1] + hourBuckets[peakStart + 2]
    const confidence = totalHours > 0 ? peakHours / totalHours : 0

    return {
        startHour: peakStart,
        endHour: peakStart + 3,
        averageHours: maxSum / days,
        confidence: Math.min(confidence * 2, 1) // Boost confidence, cap at 1
    }
}

/**
 * Calculates focus quality score (0-100)
 * Based on session length, break frequency, and interruptions
 */
export async function calculateFocusScore(
    userId: string,
    date: Date
): Promise<number> {
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
        },
        orderBy: { startTime: 'asc' }
    })

    if (entries.length === 0) return 0

    let score = 100
    let totalMinutes = 0
    const sessionMinutes: number[] = []

    // Analyze each work session
    entries.forEach(entry => {
        const start = new Date(entry.startTime)
        const end = entry.endTime ? new Date(entry.endTime) : new Date()
        const duration = differenceInMinutes(end, start)

        totalMinutes += duration
        sessionMinutes.push(duration)

        // Penalty for very short sessions (<30 min)
        if (duration < 30) {
            score -= 5
        }

        // Bonus for optimal sessions (60-120 min)
        if (duration >= 60 && duration <= 120) {
            score += 3
        }

        // Penalty for extreme sessions (>4 hours without entry break)
        if (duration > 240) {
            score -= 10
        }
    })

    // Count total breaks
    const totalBreaks = entries.reduce((sum, entry) => sum + (entry.breaks?.length || 0), 0)

    // Account for break frequency
    const workHours = totalMinutes / 60
    const breaksPerHour = workHours > 0 ? totalBreaks / workHours : 0

    if (breaksPerHour < 0.5 && workHours > 4) {
        score -= 15 // Too few breaks for long work day
    } else if (breaksPerHour > 2) {
        score -= 10 // Too many breaks
    }

    // Ideal: 1-2 breaks per 4 hours
    if (breaksPerHour >= 0.5 && breaksPerHour <= 1) {
        score += 5
    }

    // Normalize to 0-100
    return Math.max(0, Math.min(100, score))
}

/**
 * Analyzes work patterns and returns insights
 */
export async function analyzeWorkPatterns(
    userId: string,
    days: number = 30
): Promise<WorkPatterns> {
    const startDate = subDays(new Date(), days)

    const entries = await prisma.timeEntry.findMany({
        where: {
            userId,
            startTime: { gte: startDate }
        },
        include: {
            breaks: true
        },
        orderBy: { startTime: 'asc' }
    })

    if (entries.length === 0) {
        return {
            averageSessionLength: 0,
            longestSession: 0,
            breaksTaken: 0,
            mostProductiveDay: 'Tuesday',
            leastProductiveDay: 'Friday',
            averageBreaksPerDay: 0
        }
    }

    // Calculate session statistics
    const sessions: number[] = []
    let totalBreaks = 0

    entries.forEach(entry => {
        const start = new Date(entry.startTime)
        const end = entry.endTime ? new Date(entry.endTime) : new Date()
        const duration = differenceInMinutes(end, start)
        sessions.push(duration)
        totalBreaks += entry.breaks?.length || 0
    })

    const averageSession = sessions.reduce((a, b) => a + b, 0) / sessions.length
    const longestSession = Math.max(...sessions)

    // Analyze productivity by day of week
    const dayBuckets: Record<string, number> = {
        Sunday: 0,
        Monday: 0,
        Tuesday: 0,
        Wednesday: 0,
        Thursday: 0,
        Friday: 0,
        Saturday: 0
    }

    entries.forEach(entry => {
        const dayName = new Date(entry.startTime).toLocaleDateString('en-US', { weekday: 'long' })
        const start = new Date(entry.startTime)
        const end = entry.endTime ? new Date(entry.endTime) : new Date()
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
        dayBuckets[dayName] += hours
    })

    let mostProductiveDay = 'Tuesday'
    let leastProductiveDay = 'Friday'
    let maxHours = 0
    let minHours = Infinity

    Object.entries(dayBuckets).forEach(([day, hours]) => {
        if (hours > maxHours && hours > 0) {
            maxHours = hours
            mostProductiveDay = day
        }
        if (hours < minHours && hours > 0) {
            minHours = hours
            leastProductiveDay = day
        }
    })

    return {
        averageSessionLength: Math.round(averageSession),
        longestSession: Math.round(longestSession),
        breaksTaken: totalBreaks,
        mostProductiveDay,
        leastProductiveDay,
        averageBreaksPerDay: totalBreaks / days
    }
}

/**
 * Calculates efficiency score based on tasks completed vs time spent
 */
export async function calculateEfficiencyScore(
    userId: string,
    date: Date
): Promise<number> {
    const dayStart = startOfDay(date)
    const dayEnd = addHours(dayStart, 24)

    // Get hours worked
    const entries = await prisma.timeEntry.findMany({
        where: {
            userId,
            startTime: {
                gte: dayStart,
                lt: dayEnd
            }
        }
    })

    const totalMinutes = entries.reduce((sum, entry) => {
        const start = new Date(entry.startTime)
        const end = entry.endTime ? new Date(entry.endTime) : new Date()
        return sum + differenceInMinutes(end, start)
    }, 0)

    const hoursWorked = totalMinutes / 60

    if (hoursWorked === 0) return 0

    // Get tasks completed
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

    // Calculate tasks per hour
    const tasksPerHour = tasksCompleted / hoursWorked

    // Normalize to 0-100 scale (assuming 0.5-1 task/hour is good)
    const score = Math.min(100, tasksPerHour * 100)

    return Math.round(score)
}
