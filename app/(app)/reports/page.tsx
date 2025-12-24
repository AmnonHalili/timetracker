import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { MonthSelector } from "@/components/reports/MonthSelector"
import { ReportTable } from "@/components/reports/ReportTable"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { UserSelector } from "@/components/reports/UserSelector"
import { getReportData } from "@/lib/report-service"
import { ExportButton } from "@/components/reports/ExportButton"
import { filterVisibleUsers } from "@/lib/hierarchy-utils"

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

    // If Admin or Manager, fetch project users and handle targetUserId
    if (["ADMIN", "MANAGER"].includes(currentUser.role) && currentUser.projectId) {
        // Fetch all active users in the project (needed for hierarchy calculation)
        const allProjectUsers = await prisma.user.findMany({
            where: {
                projectId: currentUser.projectId,
                status: "ACTIVE"
            },
            select: { id: true, name: true, email: true, managerId: true },
            orderBy: { name: "asc" }
        })

        // Filter based on hierarchy
        projectUsers = filterVisibleUsers(allProjectUsers, { id: currentUser.id, role: currentUser.role })

        // If userId param is present, verify it belongs to the visible scope
        if (searchParams.userId) {
            const requestedUser = projectUsers.find(u => u.id === searchParams.userId)
            if (requestedUser) {
                targetUserId = searchParams.userId
            }
        }
    }

    const today = new Date()
    const currentMonth = searchParams.month ? parseInt(searchParams.month) : today.getMonth()
    const currentYear = searchParams.year ? parseInt(searchParams.year) : today.getFullYear()

    const data = await getReportData(targetUserId, currentYear, currentMonth)

    if (!data) return <div>User not found</div>
    const { report } = data

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Monthly Reports</h1>
                    <p className="text-muted-foreground">View your detailed work history</p>
                </div>
                <div className="flex flex-col gap-6">
                    {/* Controls Row */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        {projectUsers.length > 1 && (
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-muted-foreground">User</label>
                                <UserSelector currentUserId={targetUserId} users={projectUsers} />
                            </div>
                        )}
                        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-muted-foreground">Period</label>
                                <MonthSelector year={currentYear} month={currentMonth} />
                            </div>
                            <ExportButton userId={targetUserId} year={currentYear} month={currentMonth} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
                        <div className="text-2xl font-bold">{report.totalTargetHours.toFixed(2)} hrs</div>
                    </CardContent>
                </Card>
            </div>

            <ReportTable days={report.days} showWarnings={currentUser.role === "ADMIN"} />
        </div>
    )
}
