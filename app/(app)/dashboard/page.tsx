import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateBalance } from "@/lib/time-calculations"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { ControlBar } from "@/components/dashboard/ControlBar"
import { EntryHistory } from "@/components/dashboard/EntryHistory"
import { StatsWidget } from "@/components/dashboard/StatsWidget"
import { TeamStatusWidget } from "@/components/dashboard/TeamStatusWidget"

export default async function DashboardPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/login")
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            timeEntries: {
                include: { breaks: true, tasks: true }
            }
        },
    })

    if (!user) return <div>User not found</div>

    // Team Status Logic (Admin Only)
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

        teamStatus = projectUsers.map(u => {
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
                role: u.role,
                jobTitle: u.jobTitle,
                status,
                lastActive
            }
        })
    }

    const stats = calculateBalance(user)
    const activeEntry = user.timeEntries.find(e => e.endTime === null)

    // For list, use completed entries, reverse chronology
    const historyEntries = user.timeEntries.filter(e => e.endTime !== null).reverse()

    // Use accumulated deficit for remaining hours (per user definition)
    const remainingHours = stats.accumulatedDeficit

    // Fetch available tasks for the user
    const tasks = await prisma.task.findMany({
        where: {
            assignees: { some: { id: user.id } },
            status: { not: 'DONE' }
        },
        orderBy: { updatedAt: 'desc' }
    })

    return (
        <div className="w-full">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-8 items-start">
                {/* Main Content Area */}
                <div className="space-y-8 min-w-0">
                    {/* Timer Control */}
                    <ControlBar
                        activeEntry={activeEntry || null}
                        tasks={tasks}
                    />

                    {/* History List */}
                    <div className="pt-4">
                        <EntryHistory entries={historyEntries} tasks={tasks} />
                    </div>
                </div>

                {/* Right Sidebar */}
                <div className="lg:sticky lg:top-8 space-y-8">
                    {/* Stats Widget (Always visible) */}
                    <StatsWidget extraHours={stats.monthlyOvertime} remainingHours={remainingHours} />

                    {/* Team Status (Admin Only) */}
                    {user.role === "ADMIN" && (
                        <div className="pt-12">
                            <TeamStatusWidget teamStatus={teamStatus} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
