import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMonthlyReport } from "@/lib/report-calculations"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { MonthSelector } from "@/components/reports/MonthSelector"
import { ReportTable } from "@/components/reports/ReportTable"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { endOfMonth, startOfMonth } from "date-fns"

export default async function ReportsPage({
    searchParams,
}: {
    searchParams: { month?: string; year?: string }
}) {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/login")
    }

    const today = new Date()
    const month = searchParams.month ? parseInt(searchParams.month) : today.getMonth()
    const year = searchParams.year ? parseInt(searchParams.year) : today.getFullYear()

    const reportDate = new Date(year, month, 1) // First day of selected month

    // Fetch entries for the entire month
    const start = startOfMonth(reportDate)
    const end = endOfMonth(reportDate)

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            timeEntries: {
                where: {
                    startTime: {
                        gte: start,
                        lte: end,
                    },
                },
            },
        },
    })

    if (!user) return <div>User not found</div>

    const report = getMonthlyReport(user.timeEntries, reportDate, user.dailyTarget, user.workDays)

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Monthly Reports</h1>
                    <p className="text-muted-foreground">View your detailed work history</p>
                </div>
                <MonthSelector />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Worked</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{report.totalMonthlyHours.toFixed(2)} hrs</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Target Hours</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* Note: Target depends on work days passed so far? Or total potential? Current logic sums targets for passed days */}
                        <div className="text-2xl font-bold">{report.totalTargetHours.toFixed(2)} hrs</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${(report.totalMonthlyHours - report.totalTargetHours) >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {(report.totalMonthlyHours - report.totalTargetHours).toFixed(2)} hrs
                        </div>
                    </CardContent>
                </Card>
            </div>

            <ReportTable days={report.days} />
        </div>
    )
}
