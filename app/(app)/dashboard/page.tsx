import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateBalance } from "@/lib/time-calculations"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { DashboardContent } from "@/components/dashboard/DashboardContent"
import { StatsWidget } from "@/components/dashboard/StatsWidget"
import { LiveTeamStatusWidget } from "@/components/dashboard/LiveTeamStatusWidget"
import { TimePunchHeader } from "@/components/dashboard/TimePunchHeader"

import { User, TimeEntry, Task, TimeBreak, Workday, TaskStatus } from "@prisma/client"
import { startOfDay, endOfDay, startOfMonth } from "date-fns"

type DashboardUser = User & {
    timeEntries: (TimeEntry & {
        breaks: TimeBreak[]
        tasks: Task[]
        subtask?: { id: string; title: string } | null
    })[]
    workdays?: Workday[]
    pendingProjectId?: string | null
    project?: {
        workMode: "OUTPUT_BASED" | "TIME_BASED" | "PROJECT_BASED"
        workLocationLatitude: number | null
        workLocationLongitude: number | null
        workLocationRadius: number | null
        workLocationAddress: string | null
        isRemoteWork: boolean
    } | null
}

export default async function DashboardPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/login")
    }

    const today = new Date()
    const dayStart = startOfDay(today)
    const dayEnd = endOfDay(today)

    // Calculate month start for filtering time entries and workdays
    const monthStart = startOfMonth(today)

    const user = (await prisma.user.findUnique({
        where: { id: session.user.id },
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
            projectId: true, // Required for team status logic
            managerId: true, // Required for hierarchy logic
            pendingProjectId: true, // Required for pending banner
            timeEntries: {
                where: {
                    startTime: {
                        gte: monthStart
                    }
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
                    tasks: true,
                    subtask: true
                }
            },
            project: {
                select: {
                    workMode: true,
                    workLocationLatitude: true,
                    workLocationLongitude: true,
                    workLocationRadius: true,
                    workLocationAddress: true,
                    isRemoteWork: true,
                }
            }
        },
    })) as unknown as DashboardUser

    // Fetch workdays for the current month for balance calculation
    let monthlyWorkdays: Pick<Workday, 'workdayStartTime' | 'workdayEndTime'>[] = []
    let activeWorkday = null

    try {
        const todayWorkdays = await prisma.workday.findMany({
            where: {
                userId: session.user.id,
                workdayStartTime: {
                    gte: dayStart,
                    lte: dayEnd,
                },
            },
            select: {
                id: true,
                workdayStartTime: true,
                workdayEndTime: true,
            },
            orderBy: {
                workdayStartTime: 'desc',
            },
            take: 1,
        })
        activeWorkday = todayWorkdays.find(w => !w.workdayEndTime) || null

        // Fetch all workdays for the current month
        monthlyWorkdays = await prisma.workday.findMany({
            where: {
                userId: session.user.id,
                workdayStartTime: {
                    gte: monthStart,
                    lte: today,
                },
            },
            select: {
                workdayStartTime: true,
                workdayEndTime: true,
            },
            orderBy: {
                workdayStartTime: 'desc',
            },
        })
    } catch (error) {
        // If Workday model doesn't exist yet, workday will be null
        console.warn("Workday model not available yet:", error)
    }

    if (!user) return <div>User not found</div>

    const activeEntry = user.timeEntries.find(e => e.endTime === null)

    // For list, use completed entries, reverse chronology
    // Map entries to include subtask title
    const historyEntries = user.timeEntries
        .filter(e => e.endTime !== null)
        .map(entry => ({
            ...entry,
            subtask: entry.subtask ? { id: entry.subtask.id, title: entry.subtask.title } : null
        }))
        .reverse()


    // Use accumulated deficit for remaining hours (per user definition)
    // Calculate based on workdays (Start Day / End Day) instead of time entries
    const stats = calculateBalance(user, today, monthlyWorkdays)
    const remainingHours = stats.accumulatedDeficit

    // Fetch available tasks for the user with subtasks
    // Match logic from Tasks page: ADMINs see all project tasks, others see only assigned tasks
    // Exclude DONE tasks from timer selection
    const tasksWhere = user.role === 'ADMIN'
        ? {
            assignees: { some: { projectId: user.projectId || null } },
            status: { not: TaskStatus.DONE } // Exclude DONE tasks from timer
        }
        : {
            assignees: { some: { id: user.id } },
            status: { not: TaskStatus.DONE } // Exclude DONE tasks from timer
        }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tasks: any[] = []
    try {
        tasks = await prisma.task.findMany({
            where: tasksWhere,
            include: {
                subtasks: {
                    orderBy: { createdAt: 'asc' }
                }
            },
            orderBy: { updatedAt: 'desc' }
        })
    } catch {
        console.warn("Dashboard: subtasks relation not available, fetching without it")
        tasks = await prisma.task.findMany({
            where: tasksWhere,
            orderBy: { updatedAt: 'desc' }
        })
        tasks = tasks.map(t => ({ ...t, subtasks: [] }))
    }

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

    // Fetch team status for all project members
    if (user.projectId) {
        // Common selection for status display
        const userSelect = {
            id: true,
            name: true,
            email: true,
            role: true,
            jobTitle: true,
            timeEntries: {
                where: { endTime: null },
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
                    breaks: {
                        where: { endTime: null },
                        select: {
                            id: true,
                            timeEntryId: true,
                            startTime: true,
                            endTime: true,
                            reason: true,
                            locationLat: true,
                            locationLng: true,
                        }
                    }
                }
            }
        }

        // Parallel fetch for Manager, Reports, and Peers
        const [manager, directReports, peers] = await Promise.all([
            // Fetch Manager
            user.managerId ? prisma.user.findUnique({
                where: { id: user.managerId },
                select: userSelect
            }) : Promise.resolve(null),

            // Fetch Direct Reports (Children)
            prisma.user.findMany({
                where: {
                    managerId: user.id,
                    status: "ACTIVE"
                },
                select: userSelect
            }),

            // Fetch Peers (Same Manager) - Only if user has a manager
            user.managerId ? prisma.user.findMany({
                where: {
                    managerId: user.managerId,
                    status: "ACTIVE",
                    projectId: user.projectId,
                    NOT: { id: user.id } // Exclude self
                },
                select: userSelect
            }) : Promise.resolve([])
        ])

        // Combine to projectUsers
        const projectUsers = [
            ...(manager ? [manager] : []),
            ...directReports,
            ...peers
        ]

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
    // Check if user has work preferences set (weeklyHours or legacy dailyTarget)
    const hasWorkPreferences = user.weeklyHours 
        ? Object.keys(user.weeklyHours).length > 0 && Object.values(user.weeklyHours).some(h => h > 0)
        : (user.dailyTarget !== null && user.dailyTarget > 0)
    const showStats = hasWorkPreferences
    const showTeamStatus = !!user.projectId
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

            <div className={`grid grid-cols-1 ${showSidebar ? "md:grid-cols-[1fr_220px]" : ""} gap-8 items-start`}>
                {/* Main Content Area */}
                <div className="space-y-0 md:space-y-8 min-w-0">
                    <TimePunchHeader
                        workLocation={
                            user.project?.isRemoteWork
                                ? null // Remote work - no location required
                                : user.project?.workLocationLatitude && user.project?.workLocationLongitude
                                    ? {
                                        latitude: user.project.workLocationLatitude,
                                        longitude: user.project.workLocationLongitude,
                                        radius: user.project.workLocationRadius || 150,
                                    }
                                    : null
                        }
                        activeWorkday={activeWorkday}
                    />
                    <DashboardContent
                        activeEntry={activeEntry || null}
                        historyEntries={historyEntries}
                        tasks={tasks}
                    />
                </div>

                {/* Right Sidebar */}
                {showSidebar && (
                    <div className="md:sticky md:top-8 space-y-8">
                        {/* Spacer for Private Workspace Alignment */}
                        {isPrivateWorkspace && <div className="hidden md:block h-[40px]" />}

                        {/* Stats Widget (Conditionally visible) */}
                        {showStats && (
                            <StatsWidget
                                extraHours={stats.monthlyOvertime}
                                remainingHours={remainingHours}
                                activeEntryStartTime={activeWorkday?.workdayStartTime}
                                isPaused={false} // Workday based pausing not fully implemented in this view yet, assuming continuous for now or until requested
                            />
                        )}

                        {/* Team Status (Admin Only) - Hidden on mobile, shown on desktop */}
                        {showTeamStatus && (
                            <div className={`${showStats ? "pt-12" : ""} hidden md:block`}>
                                <LiveTeamStatusWidget initialStatus={teamStatus} />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div >
    )
}
