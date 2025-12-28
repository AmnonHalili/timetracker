import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { subDays } from "date-fns"
import { getAllDescendants } from "@/lib/hierarchy-utils"
import { getTeamBurnoutStatus } from "@/lib/analytics/burnout-detector"

export async function GET(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const days = parseInt(searchParams.get('days') || '7')
        const startDate = subDays(new Date(), days)

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true, projectId: true, role: true }
        })

        if (!currentUser?.projectId) {
            return NextResponse.json({
                message: "No team found"
            }, { status: 404 })
        }

        let teamMemberIds: string[] = []

        if (session.user.role === "ADMIN") {
            const allUsers = await prisma.user.findMany({
                where: { projectId: currentUser.projectId },
                select: { id: true }
            })
            teamMemberIds = allUsers.map(u => u.id)
        } else {
            const allUsers = await prisma.user.findMany({
                where: { projectId: currentUser.projectId },
                select: { id: true, managerId: true }
            })

            const descendants = getAllDescendants(currentUser.id, allUsers as any)
            teamMemberIds = [currentUser.id, ...descendants]
        }

        const snapshots = await prisma.analyticsSnapshot.findMany({
            where: {
                userId: { in: teamMemberIds },
                date: { gte: startDate }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        jobTitle: true,
                        role: true
                    }
                }
            },
            orderBy: { date: 'desc' }
        })

        const totalHours = snapshots.reduce((sum, s) => sum + s.totalHours, 0)
        const totalTasks = snapshots.reduce((sum, s) => sum + s.tasksCompleted, 0)
        const avgFocusScore = snapshots.length > 0
            ? snapshots.reduce((sum, s) => sum + s.focusScore, 0) / snapshots.length
            : 0

        const burnoutStatus = await getTeamBurnoutStatus(teamMemberIds)
        const burnoutAlerts = Array.from(burnoutStatus.entries()).map(([userId, assessment]) => {
            const user = snapshots.find(s => s.userId === userId)?.user
            return {
                userId,
                name: user?.name || 'Unknown',
                jobTitle: user?.jobTitle,
                riskLevel: assessment.riskLevel,
                score: assessment.score,
                factors: assessment.factors,
                recommendations: assessment.recommendations
            }
        }).sort((a, b) => b.score - a.score)

        const dayBuckets: Record<string, { hours: number; tasks: number }> = {
            Sunday: { hours: 0, tasks: 0 },
            Monday: { hours: 0, tasks: 0 },
            Tuesday: { hours: 0, tasks: 0 },
            Wednesday: { hours: 0, tasks: 0 },
            Thursday: { hours: 0, tasks: 0 },
            Friday: { hours: 0, tasks: 0 },
            Saturday: { hours: 0, tasks: 0 }
        }

        snapshots.forEach(snapshot => {
            const dayName = new Date(snapshot.date).toLocaleDateString('en-US', { weekday: 'long' })
            dayBuckets[dayName].hours += snapshot.totalHours
            dayBuckets[dayName].tasks += snapshot.tasksCompleted
        })

        const efficiencyByDay = Object.entries(dayBuckets).map(([day, data]) => ({
            day,
            efficiency: data.hours > 0 ? Math.round((data.tasks / data.hours) * 100) : 0,
            hours: Math.round(data.hours * 10) / 10,
            tasks: data.tasks
        })).sort((a, b) => b.efficiency - a.efficiency)

        const userStats = new Map<string, { hours: number; tasks: number; name: string; jobTitle?: string }>()

        snapshots.forEach(snapshot => {
            const existing = userStats.get(snapshot.userId) || {
                hours: 0,
                tasks: 0,
                name: snapshot.user.name,
                jobTitle: snapshot.user.jobTitle || undefined
            }
            existing.hours += snapshot.totalHours
            existing.tasks += snapshot.tasksCompleted
            userStats.set(snapshot.userId, existing)
        })

        const workloadDistribution = Array.from(userStats.entries()).map(([userId, stats]) => ({
            userId,
            name: stats.name,
            jobTitle: stats.jobTitle,
            hours: Math.round(stats.hours * 10) / 10,
            tasks: stats.tasks,
            avgHoursPerDay: Math.round((stats.hours / days) * 10) / 10
        })).sort((a, b) => b.hours - a.hours)

        const topPerformers = workloadDistribution
            .filter(w => w.tasks > 0)
            .map(w => ({
                ...w,
                efficiency: Math.round((w.tasks / w.hours) * 100)
            }))
            .sort((a, b) => b.tasks - a.tasks)
            .slice(0, 5)

        return NextResponse.json({
            teamSize: teamMemberIds.length,
            period: `last_${days}_days`,
            summary: {
                totalHours: Math.round(totalHours * 10) / 10,
                avgHoursPerPerson: Math.round((totalHours / teamMemberIds.length) * 10) / 10,
                tasksCompleted: totalTasks,
                teamFocusScore: Math.round(avgFocusScore)
            },
            burnoutAlerts: {
                critical: burnoutAlerts.filter(a => a.riskLevel === 'CRITICAL'),
                high: burnoutAlerts.filter(a => a.riskLevel === 'HIGH'),
                medium: burnoutAlerts.filter(a => a.riskLevel === 'MEDIUM'),
                count: burnoutAlerts.length
            },
            efficiency: {
                byDay: efficiencyByDay,
                mostProductiveDay: efficiencyByDay[0]?.day || 'Tuesday',
                trend: efficiencyByDay.length > 1
                    ? `${efficiencyByDay[0].day} is ${Math.round(((efficiencyByDay[0].efficiency - efficiencyByDay[efficiencyByDay.length - 1].efficiency) / efficiencyByDay[efficiencyByDay.length - 1].efficiency) * 100)}% more productive`
                    : ''
            },
            workloadDistribution,
            topPerformers
        })
    } catch (error) {
        console.error("Error fetching team analytics:", error)
        return NextResponse.json(
            { message: "Error fetching team analytics" },
            { status: 500 }
        )
    }
}
