import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { subDays } from "date-fns"
import { calculatePeakHours, analyzeWorkPatterns } from "@/lib/analytics/productivity-calculator"

export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const days = parseInt(searchParams.get('days') || '30')
        const startDate = subDays(new Date(), days)

        const snapshots = await prisma.analyticsSnapshot.findMany({
            where: {
                userId: session.user.id,
                date: {
                    gte: startDate
                }
            },
            orderBy: { date: 'desc' }
        })

        if (snapshots.length === 0) {
            return NextResponse.json({
                summary: {
                    period: `last_${days}_days`,
                    totalHours: 0,
                    avgDailyHours: 0,
                    tasksCompleted: 0,
                    focusScore: 0,
                    trend: "0%"
                },
                peakHours: null,
                patterns: null,
                scores: {
                    focus: 0,
                    efficiency: 0,
                    balance: 0
                },
                hasData: false
            })
        }

        const totalHours = snapshots.reduce((sum, s) => sum + s.totalHours, 0)
        const totalTasks = snapshots.reduce((sum, s) => sum + s.tasksCompleted, 0)
        const avgFocusScore = snapshots.reduce((sum, s) => sum + s.focusScore, 0) / snapshots.length
        const avgEfficiencyScore = snapshots.reduce((sum, s) => sum + s.efficiencyScore, 0) / snapshots.length
        const avgBalanceScore = snapshots.reduce((sum, s) => sum + s.balanceScore, 0) / snapshots.length

        const oneWeekAgo = subDays(new Date(), 7)
        const lastWeek = snapshots.filter(s => new Date(s.date) >= oneWeekAgo)
        const previousWeek = snapshots.filter(s => new Date(s.date) < oneWeekAgo && new Date(s.date) >= subDays(oneWeekAgo, 7))

        let trend = "0%"
        if (previousWeek.length > 0 && lastWeek.length > 0) {
            const lastWeekAvg = lastWeek.reduce((sum, s) => sum + s.focusScore, 0) / lastWeek.length
            const prevWeekAvg = previousWeek.reduce((sum, s) => sum + s.focusScore, 0) / previousWeek.length
            const change = ((lastWeekAvg - prevWeekAvg) / prevWeekAvg) * 100
            trend = change > 0 ? `+${change.toFixed(0)}%` : `${change.toFixed(0)}%`
        }

        const peakHours = await calculatePeakHours(session.user.id, days)
        const patterns = await analyzeWorkPatterns(session.user.id, days)
        const latestSnapshot = snapshots[0]

        return NextResponse.json({
            summary: {
                period: `last_${days}_days`,
                totalHours: Math.round(totalHours * 10) / 10,
                avgDailyHours: Math.round((totalHours / days) * 10) / 10,
                tasksCompleted: totalTasks,
                focusScore: Math.round(avgFocusScore),
                trend,
                daysWithData: snapshots.length
            },
            peakHours: peakHours.confidence > 0.5 ? {
                start: peakHours.startHour,
                end: peakHours.endHour,
                confidence: Math.round(peakHours.confidence * 100),
                avgProductivity: Math.round(peakHours.averageHours * 10) / 10
            } : null,
            patterns: {
                mostProductiveDay: patterns.mostProductiveDay,
                leastProductiveDay: patterns.leastProductiveDay,
                averageSessionLength: patterns.averageSessionLength,
                longestSession: patterns.longestSession,
                breaksPerDay: Math.round(patterns.averageBreaksPerDay * 10) / 10
            },
            scores: {
                focus: Math.round(avgFocusScore),
                efficiency: Math.round(avgEfficiencyScore),
                balance: Math.round(avgBalanceScore)
            },
            burnout: {
                risk: latestSnapshot.burnoutRisk,
                consecutiveDays: latestSnapshot.consecutiveDays,
                overtimeHours: Math.round(latestSnapshot.overtimeHours * 10) / 10
            },
            hasData: true
        })
    } catch (error) {
        console.error("Error fetching personal analytics:", error)
        return NextResponse.json(
            { message: "Error fetching analytics" },
            { status: 500 }
        )
    }
}
