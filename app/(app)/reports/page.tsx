import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { ReportTable } from "@/components/reports/ReportTable"
import { getReportData } from "@/lib/report-service"
import { filterVisibleUsers } from "@/lib/hierarchy-utils"
import { ReportsPageHeader } from "@/components/reports/ReportsPageHeader"
import { ReportsControls } from "@/components/reports/ReportsControls"
import { ReportsSummaryCards } from "@/components/reports/ReportsSummaryCards"

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
            select: { id: true, name: true, email: true, managerId: true, role: true },
            orderBy: { name: "asc" }
        })

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
        const visibleUsers = filterVisibleUsers(allProjectUsers, { id: currentUser.id, role: currentUser.role }, secondaryRelations)

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

        projectUsers = sortedUsers

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
                <ReportsPageHeader />
                <ReportsControls
                    projectUsers={projectUsers}
                    targetUserId={targetUserId}
                    currentYear={currentYear}
                    currentMonth={currentMonth}
                />
            </div>

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

                    <ReportTable days={report.days} showWarnings={currentUser.role === "ADMIN"} />
                </>
            )}
        </div>
    )
}
