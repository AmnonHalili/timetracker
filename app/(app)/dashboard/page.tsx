import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateBalance } from "@/lib/time-calculations"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { DashboardContent } from "@/components/dashboard/DashboardContent"
import { StatsWidget } from "@/components/dashboard/StatsWidget"
import { LiveTeamStatusWidget } from "@/components/dashboard/LiveTeamStatusWidget"
import { TimePunchHeader } from "@/components/dashboard/TimePunchHeader"

import { User, TimeEntry, Task, TimeBreak, Workday } from "@prisma/client"
import { startOfDay, endOfDay, startOfMonth } from "date-fns"

type DashboardUser = User & {
    timeEntries: (TimeEntry & {
        breaks: TimeBreak[]
        tasks: Task[]
        subtask?: { id: string; title: string } | null
    })[]
    workdays?: Workday[]
    weeklyHours?: Record<string, number> | null
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

    if (!session || !session.user) {
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
            status: true,
            dailyTarget: true,
            workDays: true,
            weeklyHours: true,
            createdAt: true,
            projectId: true,
            project: {
                select: {
                    workMode: true,
                    workLocationLatitude: true,
                    workLocationLongitude: true,
                    workLocationRadius: true,
                    workLocationAddress: true,
                    isRemoteWork: true
                }
            },
            timeEntries: {
                where: {
                    userId: session.user.id,
                    projectId: session.user.projectId,
                    startTime: {
                        gte: dayStart,
                        lte: dayEnd,
                    },
                },
                include: {
                    breaks: true,
                    tasks: true,
                    subtask: {
                        select: {
                            id: true,
                            title: true
                        }
                    }
                },
                orderBy: {
                    startTime: "desc",
                },
            },
            workdays: {
                where: {
                    userId: session.user.id,
                    projectId: session.user.projectId,
                    workdayStartTime: {
                        gte: dayStart,
                        lte: dayEnd,
                    },
                },
            },
        },
    })) as unknown as DashboardUser

    if (!user) {
        redirect("/login")
    }

    // Process workdays to find the active one
    const todayWorkdays = user.workdays || []
    const activeWorkday = todayWorkdays.find(w => !w.workdayEndTime) || null

    // Fetch all workdays for the current month for balance calculation
    const monthlyWorkdays = await prisma.workday.findMany({
        where: {
            userId: session.user.id,
            projectId: session.user.projectId,
            workdayStartTime: {
                gte: monthStart,
                lte: today,
            },
        },
        select: {
            workdayStartTime: true,
            workdayEndTime: true,
        },
    })

    // Fetch tasks for the current project for DashboardContent
    const tasks = await prisma.task.findMany({
        where: {
            projectId: session.user.projectId,
            // Only tasks assigned to the user OR user is admin
            ...(session.user.role !== 'ADMIN' ? {
                assignees: {
                    some: { id: session.user.id }
                }
            } : {})
        },
        include: {
            subtasks: true
        }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const balanceData = calculateBalance(user as any, today, monthlyWorkdays)

    // Find active time entry
    const activeEntry = await prisma.timeEntry.findFirst({
        where: {
            userId: session.user.id,
            projectId: session.user.projectId,
            endTime: null,
        },
        include: {
            breaks: true,
            tasks: {
                select: { id: true, title: true }
            },
            subtask: {
                select: { id: true, title: true }
            }
        },
    })

    // Map workLocation for TimePunchHeader - ensure types match (numbers can't be null in WorkLocation)
    const workLocation = (user.project &&
        user.project.workLocationLatitude !== null &&
        user.project.workLocationLongitude !== null &&
        user.project.workLocationRadius !== null)
        ? {
            latitude: user.project.workLocationLatitude as number,
            longitude: user.project.workLocationLongitude as number,
            radius: user.project.workLocationRadius as number,
            address: user.project.workLocationAddress,
            isRemoteWork: user.project.isRemoteWork
        } : null

    const hasWorkPreferences = (user.workDays && user.workDays.length > 0) ||
        (user.dailyTarget !== null && user.dailyTarget > 0)
    const showStats = hasWorkPreferences
    const showTeamStatus = !!user.projectId
    const showSidebar = showStats || showTeamStatus

    return (
        <div className="w-full">
            <div className={`grid grid-cols-1 ${showSidebar ? "xl:grid-cols-[1fr_300px] lg:grid-cols-[1fr_280px]" : ""} gap-6 items-start`}>
                <div className="flex flex-col gap-6 min-w-0">
                    <TimePunchHeader
                        activeWorkday={activeWorkday}
                        workLocation={workLocation}
                    />

                    <DashboardContent
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        activeEntry={activeEntry as any}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        historyEntries={user.timeEntries as any}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        tasks={tasks as any}
                    />
                </div>

                {showSidebar && (
                    <div className="flex flex-col gap-6 lg:sticky lg:top-6">
                        {showStats && (
                            <StatsWidget
                                extraHours={balanceData.monthlyOvertime}
                                remainingHours={balanceData.accumulatedDeficit}
                                activeEntryStartTime={activeEntry?.startTime}
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                isPaused={(activeEntry as any)?.breaks?.some((b: any) => !b.endTime)}
                            />
                        )}

                        {showTeamStatus && (
                            <div className="hidden lg:block">
                                <LiveTeamStatusWidget />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
