import { prisma } from "@/lib/prisma"
import { getMonthlyReport } from "@/lib/report-calculations"
import { startOfMonth, endOfMonth } from "date-fns"
import { TimeEntry, TimeBreak, Workday } from "@prisma/client"

type TimeEntryWithBreaks = TimeEntry & {
    breaks?: TimeBreak[]
}

export async function getReportData(userId: string, year: number, month: number, projectId?: string | null) {
    const reportDate = new Date(year, month, 1) // First day of selected month
    const start = startOfMonth(reportDate)
    const end = endOfMonth(reportDate)

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            dailyTarget: true,
            workDays: true,
            weeklyHours: true,
            createdAt: true,
            projectId: true,
            timeEntries: {
                where: {
                    startTime: {
                        gte: start,
                        lte: end,
                    },
                    projectId: projectId,
                },
                orderBy: {
                    startTime: 'asc'
                },
                select: {
                    id: true,
                    userId: true,
                    projectId: true,
                    startTime: true,
                    endTime: true,
                    description: true,
                    isManual: true,
                    createdAt: true,
                    updatedAt: true,
                    subtaskId: true,
                    breaks: true,
                    tasks: {
                        where: {
                            projectId: projectId
                        },
                        select: {
                            id: true,
                            title: true,
                            projectId: true
                        }
                    }
                },
            },
            workdays: {
                where: {
                    workdayStartTime: {
                        gte: start,
                        lte: end,
                    },
                    projectId: projectId,
                },
                orderBy: {
                    workdayStartTime: 'desc' // Most recent first
                },
                select: {
                    id: true,
                    workdayStartTime: true,
                    workdayEndTime: true,
                    projectId: true,
                },
            },
        },
    })

    if (!user) return null

    // Limit start by createdAt (normalize to start of day if needed, but strict is fine)
    // Limit end by today (end of today)
    const today = new Date()

    // Map user relations to match getMonthlyReport requirements
    const entries = (user.timeEntries as unknown) as TimeEntryWithBreaks[]
    const workdays = (user.workdays as unknown) as Pick<Workday, 'workdayStartTime' | 'workdayEndTime'>[]
    const weeklyHours = (user.weeklyHours as unknown) as Record<string, number> | null

    const report = getMonthlyReport(
        entries,
        workdays,
        reportDate,
        user.dailyTarget ?? 0,
        user.workDays,
        user.createdAt,
        today,
        weeklyHours
    )

    return {
        user,
        report,
        reportDate
    }
}
