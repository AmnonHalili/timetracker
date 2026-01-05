import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { ReportTable } from "@/components/reports/ReportTable"
import { AllUsersReportTable } from "@/components/reports/AllUsersReportTable"
import { getReportData } from "@/lib/report-service"
import { filterVisibleUsers } from "@/lib/hierarchy-utils"
import { ReportsPageHeader } from "@/components/reports/ReportsPageHeader"
import { ReportsControls } from "@/components/reports/ReportsControls"
import { ReportsSummaryCards } from "@/components/reports/ReportsSummaryCards"
import { AIInsightsNotification } from "@/components/reports/AIInsightsNotification"

export const dynamic = "force-dynamic"

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

    console.log(`[ReportsPage] Render for user ${session.user.id}. DB ProjectId: ${currentUser?.projectId}. Params ProjectId: ${currentUser?.projectId}`)

    if (!currentUser) redirect("/login")

    // If Admin or Manager, fetch project users and handle targetUserId
    if (["ADMIN", "MANAGER"].includes(currentUser.role) && currentUser.projectId) {
        const today = new Date()
        const currentMonth = searchParams.month ? parseInt(searchParams.month) : today.getMonth()
        const currentYear = searchParams.year ? parseInt(searchParams.year) : today.getFullYear()
        const reportPeriodEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59) // Last moment of the selected month

        // Fetch all active users in the project, including removed users if removedAt is after the report period end
        // This allows showing historical data for users who were removed
        let allProjectUsers: Array<{ id: string; name: string | null; email: string; managerId: string | null; role: string; removedAt: Date | null }>
        try {
            // Try with removedAt field (after migration)
            allProjectUsers = await prisma.user.findMany({
                where: {
                    projectId: currentUser.projectId,
                    status: "ACTIVE",
                    OR: [
                        { removedAt: null } as never, // Active users
                        { removedAt: { gt: reportPeriodEnd } } as never // Users removed after the report period
                    ]
                },
                select: { id: true, name: true, email: true, managerId: true, role: true, removedAt: true } as never,
                orderBy: { name: "asc" } as never
            }) as unknown as Array<{ id: string; name: string | null; email: string; managerId: string | null; role: string; removedAt: Date | null }>
        } catch {
            // Fallback: if removedAt field doesn't exist yet (migration not run), fetch all active users
            const users = await prisma.user.findMany({
                where: {
                    projectId: currentUser.projectId,
                    status: "ACTIVE"
                },
                select: { id: true, name: true, email: true, managerId: true, role: true },
                orderBy: { name: "asc" }
            })
            allProjectUsers = users.map(u => ({ ...u, removedAt: null }))
        }

        // Fetch secondary manager relationships for visibility with VIEW_TIME permission
        const allSecondaryRelations = await prisma.secondaryManager.findMany({
            where: {
                OR: [
                    { managerId: currentUser.id }, // Where current user is the secondary manager
                    { employeeId: currentUser.id }  // Where current user is the employee
                ]
            },
            select: {
                employeeId: true,
                managerId: true,
                permissions: true
            }
        })

        // Filter to only include relationships with VIEW_TIME permission
        const secondaryRelations = allSecondaryRelations.filter(rel =>
            rel.managerId === currentUser.id && rel.permissions.includes('VIEW_TIME')
        )

        // Filter based on hierarchy + secondary manager relationships
        // Note: For removed users, we need to reconstruct their hierarchy at the time they were active
        // For simplicity, we'll use current hierarchy structure but filter removed users appropriately
        const visibleUsers = filterVisibleUsers(
            allProjectUsers.map(u => ({ ...u, removedAt: undefined })), // Remove removedAt for filterVisibleUsers
            { id: currentUser.id, role: currentUser.role },
            secondaryRelations
        ).map(vUser => allProjectUsers.find(u => u.id === vUser.id)!)
            .filter(Boolean) as Array<{ id: string; name: string | null; email: string; managerId: string | null; role: string; removedAt: Date | null }>

        // Sort by hierarchy: admins first, then managers, then employees
        // Within same role, sort by hierarchy level (0 = top level)
        const sortedUsers = visibleUsers.sort((a, b) => {
            // Role priority: ADMIN > MANAGER > EMPLOYEE
            const roleOrder: Record<string, number> = { 'ADMIN': 0, 'MANAGER': 1, 'EMPLOYEE': 2 }
            const roleA = roleOrder[a.role || 'EMPLOYEE'] ?? 3
            const roleB = roleOrder[b.role || 'EMPLOYEE'] ?? 3

            if (roleA !== roleB) {
                return roleA - roleB
            }

            // Same role - sort by hierarchy level
            const getLevel = (userId: string): number => {
                let level = 0
                let currentId = userId
                const visited = new Set<string>()

                while (currentId) {
                    const user = visibleUsers.find(u => u.id === currentId)
                    if (!user || !user.managerId || visited.has(currentId)) break
                    visited.add(currentId)
                    level++
                    currentId = user.managerId
                }

                return level
            }

            const levelA = getLevel(a.id)
            const levelB = getLevel(b.id)

            if (levelA !== levelB) {
                return levelA - levelB // Lower level = higher in hierarchy
            }

            // Same level - sort by name
            return (a.name || '').localeCompare(b.name || '')
        })

        // Map to remove removedAt from the final projectUsers array (for compatibility)
        projectUsers = sortedUsers.map(user => ({ id: user.id, name: user.name, email: user.email }))

        // If userId param is present, verify it belongs to the visible scope
        // Note: "all" is handled separately for export, but we still show a single user's report on screen
        if (searchParams.userId && searchParams.userId !== "all") {
            const requestedUser = projectUsers.find(u => u.id === searchParams.userId)
            if (requestedUser) {
                targetUserId = searchParams.userId
            }
        }
    }

    const today = new Date()
    const currentMonth = searchParams.month ? parseInt(searchParams.month) : today.getMonth()
    const currentYear = searchParams.year ? parseInt(searchParams.year) : today.getFullYear()
    const isAllUsersSelected = searchParams.userId === "all" && ["ADMIN", "MANAGER"].includes(currentUser.role)



    // Handle "all users" view
    if (isAllUsersSelected && projectUsers.length > 0) {
        // Fetch report data for all visible users
        const allUsersData = await Promise.all(
            projectUsers.map(async (user) => {
                const userData = await getReportData(user.id, currentYear, currentMonth, currentUser.projectId)
                if (!userData) return null
                return {
                    userId: user.id,
                    userName: user.name,
                    userEmail: user.email,
                    days: userData.report.days,
                    totalMonthlyHours: userData.report.totalMonthlyHours,
                    totalTargetHours: userData.report.totalTargetHours,
                }
            })
        )

        // Filter out null values (users without data)
        const validUsersData = allUsersData.filter((data): data is NonNullable<typeof data> => data !== null)

        return (
            <div className="container mx-auto p-4 md:p-8 space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <ReportsPageHeader />
                    <ReportsControls
                        projectUsers={projectUsers}
                        targetUserId={targetUserId}
                        loggedInUserId={session.user.id}
                        currentYear={currentYear}
                        currentMonth={currentMonth}
                    />
                </div>

                <AIInsightsNotification />

                {validUsersData.length === 0 ? (
                    <div className="text-center py-12 bg-muted/20 rounded-lg border border-dashed">
                        <p className="text-muted-foreground">No reports available for this period yet.</p>
                    </div>
                ) : (
                    <AllUsersReportTable
                        usersData={validUsersData}
                        showWarnings={currentUser.role === "ADMIN"}
                    />
                )}
            </div>
        )
    }

    // Single user view (existing logic)
    const data = await getReportData(targetUserId, currentYear, currentMonth, currentUser?.projectId)

    if (!data) return <div>User not found</div>
    const { report } = data

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <ReportsPageHeader />
                <ReportsControls
                    projectUsers={projectUsers}
                    targetUserId={targetUserId}
                    loggedInUserId={session.user.id}
                    currentYear={currentYear}
                    currentMonth={currentMonth}
                />
            </div>

            <AIInsightsNotification />

            {report.days.length === 0 ? (
                <div className="text-center py-12 bg-muted/20 rounded-lg border border-dashed">
                    <p className="text-muted-foreground">No reports available for this period yet.</p>
                </div>
            ) : (
                <>
                    <ReportsSummaryCards
                        totalWorked={report.totalMonthlyHours}
                        totalTarget={report.totalTargetHours}
                        hasDailyTarget={!!(data.user.dailyTarget && data.user.dailyTarget > 0)}
                    />

                    <ReportTable days={report.days} showWarnings={currentUser.role === "ADMIN"} userId={targetUserId} />
                </>
            )}
        </div>
    )
}
