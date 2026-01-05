import { prisma } from "@/lib/prisma"
import { getMonthlyReport } from "@/lib/report-calculations"
import { startOfMonth, endOfMonth } from "date-fns"

export async function getReportData(userId: string, year: number, month: number, projectId?: string | null) {
    const reportDate = new Date(year, month, 1) // First day of selected month
    const start = startOfMonth(reportDate)
    const end = endOfMonth(reportDate)

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            jobTitle: true,
            dailyTarget: true,
            workDays: true,
            weeklyHours: true,
            createdAt: true,
            timeEntries: {
                where: {
                    startTime: {
                        gte: start,
                        lte: end,
                    },
                    projectId: projectId
                },
                orderBy: {
                    startTime: 'asc'
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
                },
            },
        },
    })

    if (!user) return null

    // Limit start by createdAt (normalize to start of day if needed, but strict is fine)
    // Limit end by today (end of today)
    const today = new Date()

    // For "Project Start", we might want project creation date if user joined later but is visualizing project?
    // Requirement: "from the day the project or user account was opened".
    // Let's use user.createdAt as per requirement for "Simple User" or "Project".
    // If project exists, we should maybe check project.createdAt? 
    // "start from the day the project OR the simple user...". 
    // If user has project, maybe project date? 
    // Let's stick to user.createdAt as safe default, user usually created with project or after.

    const report = getMonthlyReport(
        user.timeEntries,
        user.workdays || [],
        reportDate,
        user.dailyTarget ?? 0,
        user.workDays,
        user.createdAt,
        today,
        user.weeklyHours
    )

    return {
        user,
        report,
        reportDate
    }
}
