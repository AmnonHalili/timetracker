import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateBalance } from "@/lib/time-calculations"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { DashboardContent } from "@/components/dashboard/DashboardContent"
import { StatsWidget } from "@/components/dashboard/StatsWidget"
import { TeamStatusWidget } from "@/components/dashboard/TeamStatusWidget"

import { User, TimeEntry, Task, TimeBreak } from "@prisma/client"

type DashboardUser = User & {
    timeEntries: (TimeEntry & {
        breaks: TimeBreak[]
        tasks: Task[]
    })[]
    pendingProjectId?: string | null
}

export default async function DashboardPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/login")
    }

    const user = (await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            timeEntries: {
                include: { breaks: true, tasks: true }
            },
            project: {
                select: { workMode: true }
            }
        },
    })) as unknown as DashboardUser

    if (!user) return <div>User not found</div>

    const activeEntry = user.timeEntries.find(e => e.endTime === null)

    // For list, use completed entries, reverse chronology
    const historyEntries = user.timeEntries.filter(e => e.endTime !== null).reverse()


    // Use accumulated deficit for remaining hours (per user definition)
    const stats = calculateBalance(user)
    const remainingHours = stats.accumulatedDeficit

    // Fetch available tasks for the user with subtasks
    const tasks = await prisma.task.findMany({
        where: {
            assignees: { some: { id: user.id } },
            status: { not: 'DONE' }
        },
        include: {
            subtasks: {
                orderBy: { createdAt: 'asc' }
            }
        },
        orderBy: { updatedAt: 'desc' }
    })

    // Check if user has no project (Private Workspace Mode)
    const isPrivateWorkspace = !user.projectId

    // Team Status Logic (Admin Only) - Define with default empty
    let teamStatus: Array<{
        userId: string;
        name: string | null;
        email: string;
        role: "ADMIN" | "EMPLOYEE";
        jobTitle: string | null;
        status: 'WORKING' | 'BREAK' | 'OFFLINE';
        lastActive?: Date;
    }> = []

    // Only fetch team status if admin
    if (user.role === "ADMIN" && user.projectId) {
        const projectUsers = await prisma.user.findMany({
            where: {
                projectId: user.projectId,
                status: "ACTIVE",
                NOT: { id: user.id } // Exclude self from team view
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                jobTitle: true,
                timeEntries: {
                    where: { endTime: null },
                    include: { breaks: { where: { endTime: null } } }
                }
            }
        })

        type ProjectUser = {
            id: string
            name: string
            email: string
            role: "ADMIN" | "EMPLOYEE" | "MANAGER"
            jobTitle: string | null
            timeEntries: (TimeEntry & { breaks: TimeBreak[] })[]
        }

        teamStatus = (projectUsers as unknown as ProjectUser[]).map((u) => {
            const activeEntry = u.timeEntries[0]
            let status: 'WORKING' | 'BREAK' | 'OFFLINE' = 'OFFLINE'
            let lastActive: Date | undefined = undefined

            if (activeEntry) {
                const activeBreak = activeEntry.breaks && activeEntry.breaks.length > 0
                status = activeBreak ? 'BREAK' : 'WORKING'
                lastActive = activeEntry.startTime
            }

            return {
                userId: u.id,
                name: u.name,
                email: u.email,
                role: u.role as "ADMIN" | "EMPLOYEE",
                jobTitle: u.jobTitle,
                status,
                lastActive
            }
        })
    }

    // Determine if sidebar (Stats / Team Status) should be shown
    const showStats = user.dailyTarget !== null
    const showTeamStatus = user.role === "ADMIN" && user.projectId
    const showSidebar = showStats || showTeamStatus

    return (
        <div className="w-full">
            {/* Pending Request Banner */}
            {isPrivateWorkspace && user.pendingProjectId && (
                <div className="mb-8 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-yellow-600">Join Request Pending</h3>
                        <p className="text-sm text-yellow-600/80">
                            You have requested to join a team. You can continue using your private workspace while you wait.
                        </p>
                    </div>
                </div>
            )}

            <div className={`grid grid-cols-1 ${showSidebar ? "lg:grid-cols-[1fr_220px]" : ""} gap-8 items-start`}>
                {/* Main Content Area */}
                <div className="space-y-8 min-w-0">
                    <DashboardContent
                        activeEntry={activeEntry || null}
                        historyEntries={historyEntries}
                        tasks={tasks}
                    />
                </div>

                {/* Right Sidebar */}
                {showSidebar && (
                    <div className="lg:sticky lg:top-8 space-y-8">
                        {/* Spacer for Private Workspace Alignment */}
                        {isPrivateWorkspace && <div className="hidden lg:block h-[40px]" />}

                        {/* Stats Widget (Conditionally visible) */}
                        {showStats && (
                            <StatsWidget extraHours={stats.monthlyOvertime} remainingHours={remainingHours} />
                        )}

                        {/* Team Status (Admin Only) */}
                        {showTeamStatus && (
                            <div className={showStats ? "pt-12" : ""}>
                                <TeamStatusWidget teamStatus={teamStatus} />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
