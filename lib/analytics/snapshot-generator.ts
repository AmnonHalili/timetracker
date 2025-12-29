import { prisma } from "@/lib/prisma"
import { startOfDay, addHours, subDays } from "date-fns"
import { calculateFocusScore, calculateEfficiencyScore, calculatePeakHours } from "./productivity-calculator"
import { detectBurnoutRisk } from "./burnout-detector"

export async function generateDailySnapshot(userId: string, date: Date = new Date()): Promise<void> {
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
            breaks: true
        }
    })

    let totalHours = 0
    let productiveHours = 0
    let breaksTaken = 0
    let longestSession = 0
    const sessionLengths: number[] = []
    let lateWorkHours = 0

    entries.forEach(entry => {
        const start = new Date(entry.startTime)
        const end = entry.endTime ? new Date(entry.endTime) : new Date()
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
        const minutes = hours * 60

        totalHours += hours
        sessionLengths.push(minutes)

        if (minutes > longestSession) {
            longestSession = minutes
        }

        const sessionBreaks = entry.breaks?.length || 0
        if (minutes > 30 && sessionBreaks < 3) {
            productiveHours += hours
        }

        breaksTaken += sessionBreaks

        if (start.getHours() >= 20 || start.getHours() < 6) {
            lateWorkHours += hours
        }
    })

    const averageSession = sessionLengths.length > 0
        ? sessionLengths.reduce((a, b) => a + b, 0) / sessionLengths.length
        : 0

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

    const focusScore = await calculateFocusScore(userId, date)
    const efficiencyScore = await calculateEfficiencyScore(userId, date)

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { dailyTarget: true }
    })

    const target = user?.dailyTarget || 8
    const overtimeHours = Math.max(0, totalHours - target)
    let balanceScore = 100

    if (overtimeHours > 3) balanceScore -= 30
    else if (overtimeHours > 2) balanceScore -= 20
    else if (overtimeHours > 1) balanceScore -= 10

    if (lateWorkHours > 2) balanceScore -= 25
    else if (lateWorkHours > 1) balanceScore -= 15

    balanceScore = Math.max(0, balanceScore)

    const peakHours = await calculatePeakHours(userId, 30)

    const recentEntries = await prisma.timeEntry.findMany({
        where: {
            userId,
            startTime: { gte: subDays(date, 14) }
        },
        orderBy: { startTime: 'desc' }
    })

    const workDates = new Set<string>()
    recentEntries.forEach(entry => {
        const dateKey = startOfDay(new Date(entry.startTime)).toISOString()
        workDates.add(dateKey)
    })

    const sortedDates = Array.from(workDates)
        .map(d => new Date(d))
        .sort((a, b) => b.getTime() - a.getTime())

    let consecutiveDays = 1
    for (let i = 0; i < sortedDates.length - 1; i++) {
        const diff = Math.abs(sortedDates[i].getTime() - sortedDates[i + 1].getTime()) / (1000 * 60 * 60 * 24)
        if (diff === 1) {
            consecutiveDays++
        } else {
            break
        }
    }

    const isWeekend = date.getDay() === 0 || date.getDay() === 6
    const weekendWork = isWeekend ? totalHours : 0

    const burnoutAssessment = await detectBurnoutRisk(userId)

    await prisma.analyticsSnapshot.upsert({
        where: {
            userId_date: {
                userId,
                date: dayStart
            }
        },
        create: {
            userId,
            date: dayStart,
            totalHours,
            productiveHours,
            tasksCompleted,
            breaksTaken,
            focusScore,
            efficiencyScore,
            balanceScore,
            peakHourStart: peakHours.confidence > 0.5 ? peakHours.startHour : null,
            peakHourEnd: peakHours.confidence > 0.5 ? peakHours.endHour : null,
            longestSession: Math.round(longestSession),
            averageSession: Math.round(averageSession),
            burnoutRisk: burnoutAssessment.riskLevel !== 'NONE',
            overtimeHours,
            lateWorkHours,
            weekendWork,
            consecutiveDays
        },
        update: {
            totalHours,
            productiveHours,
            tasksCompleted,
            breaksTaken,
            focusScore,
            efficiencyScore,
            balanceScore,
            peakHourStart: peakHours.confidence > 0.5 ? peakHours.startHour : null,
            peakHourEnd: peakHours.confidence > 0.5 ? peakHours.endHour : null,
            longestSession: Math.round(longestSession),
            averageSession: Math.round(averageSession),
            burnoutRisk: burnoutAssessment.riskLevel !== 'NONE',
            overtimeHours,
            lateWorkHours,
            weekendWork,
            consecutiveDays
        }
    })
}

export async function generateAllUserSnapshots(date: Date = new Date()): Promise<void> {
    const users = await prisma.user.findMany({
        where: {
            status: 'ACTIVE'
        },
        select: {
            id: true
        }
    })

    console.log(`Generating snapshots for ${users.length} users...`)

    await Promise.all(
        users.map(user => generateDailySnapshot(user.id, date))
    )

    console.log(`✅ Generated snapshots for ${users.length} users`)
}

export async function backfillSnapshots(userId: string, days: number = 30): Promise<void> {
    console.log(`Backfilling ${days} days of snapshots for user ${userId}...`)

    const promises: Promise<void>[] = []

    for (let i = 0; i < days; i++) {
        const date = subDays(new Date(), i)
        promises.push(generateDailySnapshot(userId, date))
    }

    await Promise.all(promises)

    console.log(`✅ Backfilled ${days} days of snapshots`)
}
