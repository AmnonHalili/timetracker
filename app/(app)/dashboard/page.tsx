import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateBalance } from "@/lib/time-calculations"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { StatsWidget } from "@/components/dashboard/StatsWidget"
import { ControlBar } from "@/components/dashboard/ControlBar"
import { EntryForm } from "@/components/dashboard/EntryForm"
import { EntryHistory } from "@/components/dashboard/EntryHistory"
import { isSameDay } from "date-fns"

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
                include: { breaks: true }
            }
        },
    })

    if (!user) return <div>User not found</div>

    // Team Status Logic (Admin Only)
    let teamStatus: any[] = []
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
                status,
                lastActive
            }
        })
    }

    const stats = calculateBalance(user)
    const activeEntry = user.timeEntries.find(e => e.endTime === null)

    // For list, use all entries, reverse chronology
    const historyEntries = [...user.timeEntries].reverse()
    console.log("Dashboard: History Entries", historyEntries.length)

    // Calculate remaining hours for today
    const remainingHours = Math.max(0, user.dailyTarget - stats.todayWorked)

    return (
        <div className="w-full space-y-8">
            {/* Header / Title if needed, or just spacers as per design */}

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                {/* Left: Stats */}
                <div className="lg:col-span-1">
                    <StatsWidget
                        extraHours={stats.balance}
                        remainingHours={remainingHours}
                    />
                </div>

                {/* Middle (for Admin) or Right: Team Status */}
                {user.role === "ADMIN" && (
                    <div className="lg:col-span-1">
                        <TeamStatusWidget teamStatus={teamStatus} />
                    </div>
                )}

                {/* Right: Timer & manual entry - Takes remaining space */}
                <div className={`space-y-4 ${user.role === 'ADMIN' ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                    <ControlBar activeEntry={activeEntry} />
                    <EntryForm />
                </div>
            </div>

            {/* History List */}
            <div className="pt-8">
                <EntryHistory entries={historyEntries} />
            </div>
        </div>
    )
}
