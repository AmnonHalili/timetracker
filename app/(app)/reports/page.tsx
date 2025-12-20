import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMonthlyReport } from "@/lib/report-calculations"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { MonthSelector } from "@/components/reports/MonthSelector"
import { ReportTable } from "@/components/reports/ReportTable"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { startOfMonth, endOfMonth } from "date-fns"
import { UserSelector } from "@/components/reports/UserSelector"
import { getReportData } from "@/lib/report-service"
import { ExportButton } from "@/components/reports/ExportButton"

export default async function ReportsPage({
    searchParams,
}: {
    searchParams: { month?: string; year?: string; userId?: string }
}) {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/login")
    }

    // Security & User Logic
    let targetUserId = session.user.id
    let projectUsers: { id: string; name: string | null; email: string }[] = []

    const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true, projectId: true }
    })

    if (!currentUser) redirect("/login")

    // If Admin, fetch project users and handle targetUserId
    if (currentUser.role === "ADMIN" && currentUser.projectId) {
        // Fetch all active users in the project
        projectUsers = await prisma.user.findMany({
            where: {
                projectId: currentUser.projectId,
                status: "ACTIVE"
            },
            select: { id: true, name: true, email: true },
            orderBy: { name: "asc" }
        })

        // If userId param is present, verify it belongs to the project
        if (searchParams.userId) {
            const requestedUser = projectUsers.find(u => u.id === searchParams.userId)
            if (requestedUser) {
                targetUserId = searchParams.userId
            }
        }
    }

    const today = new Date()
    const month = searchParams.month ? parseInt(searchParams.month) : today.getMonth()
    const year = searchParams.year ? parseInt(searchParams.year) : today.getFullYear()

    const data = await getReportData(targetUserId, year, month)

    if (!data) return <div>User not found</div>
    const { report } = data

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Monthly Reports</h1>
                    <p className="text-muted-foreground">View your detailed work history</p>
                </div>
                <div className="flex gap-2">
                    {currentUser.role === "ADMIN" && (
                        <UserSelector users={projectUsers} currentUserId={targetUserId} />
                    )}
                    <MonthSelector />
                    <ExportButton />
                </div>
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

            <ReportTable days={report.days} showWarnings={currentUser.role === "ADMIN"} />
        </div>
    )
}
