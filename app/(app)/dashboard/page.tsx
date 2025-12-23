import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateBalance } from "@/lib/time-calculations"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"

import { ControlBar } from "@/components/dashboard/ControlBar"
import { EntryForm } from "@/components/dashboard/EntryForm"
import { EntryHistory } from "@/components/dashboard/EntryHistory"


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
        status: 'WORKING' | 'BREAK' | 'OFFLINE';
        lastActive?: Date;
    }> = []
    if (user.role === "ADMIN" && user.projectId) {
        const projectUsers = await prisma.user.findMany({
            where: {
                projectId: user.projectId,
                status: "ACTIVE",
                NOT: { id: user.id } // Optional: Exclude self? Or include? Let's exclude for "Team View"
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true, // Fetch role
                timeEntries: {
                    where: { endTime: null },
                    include: { breaks: { where: { endTime: null } } }
                }
            }
        })

        teamStatus = projectUsers.map(u => {
            const activeEntry = u.timeEntries[0] // There should be at most one active entry
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
                role: u.role, // Pass role
                status,
                lastActive
            }
        })
    }

    const stats = calculateBalance(user)
    const activeEntry = user.timeEntries.find(e => e.endTime === null)

    // For list, use completed entries, reverse chronology
    const historyEntries = user.timeEntries.filter(e => e.endTime !== null).reverse()
    console.log("Dashboard: History Entries", historyEntries.length)

    // Calculate remaining hours for today
    const remainingHours = Math.max(0, user.dailyTarget - stats.todayWorked)

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
                    {/* Stats */}
                    <div className="space-y-4">
                        <ControlBar
                            activeEntry={activeEntry || null}
                            extraHours={stats.balance}
                            remainingHours={remainingHours}
                            tasks={tasks}
                        />
                        <EntryForm tasks={tasks} />
                    </div>

                    {/* History List */}
                    <div className="pt-4">
                        <EntryHistory entries={historyEntries} tasks={tasks} />
                    </div>
                </div>

                {/* Right Sidebar - Team Status (Admin Only) */}
                {user.role === "ADMIN" && (
                    <div className="lg:sticky lg:top-8">
                        <TeamStatusWidget teamStatus={teamStatus} />
                    </div>
                )}
            </div>
        </div>
    )
}
