import { prisma } from "@/lib/prisma"
import { getMonthlyReport } from "@/lib/report-calculations"
import { startOfMonth, endOfMonth } from "date-fns"

export async function getReportData(userId: string, year: number, month: number) {
    const reportDate = new Date(year, month, 1) // First day of selected month
    const start = startOfMonth(reportDate)
    const end = endOfMonth(reportDate)

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            timeEntries: {
                where: {
                    startTime: {
                        gte: start,
                        lte: end,
                    },
                },
                orderBy: {
                    startTime: 'asc'
                }
            },
        },
    })

    if (!user) return null

    const report = getMonthlyReport(user.timeEntries, reportDate, user.dailyTarget, user.workDays)

    return {
        user,
        report,
        reportDate
    }
}
