import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { calculateBalance } from "@/lib/time-calculations"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { StatsWidget } from "@/components/dashboard/StatsWidget"
import { ControlBar } from "@/components/dashboard/ControlBar"
import { EntryForm } from "@/components/dashboard/EntryForm"
import { TodayList } from "@/components/dashboard/TodayList"
import { isSameDay } from "date-fns"

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

    const stats = calculateBalance(user)
    const activeEntry = user.timeEntries.find(e => e.endTime === null)

    // Filter for today's entries for the list
    console.log("Dashboard: User ID", user.id)
    console.log("Dashboard: Total Entries", user.timeEntries.length)
    const todayEntries = user.timeEntries.filter(entry => {
        const isToday = isSameDay(new Date(entry.startTime), new Date())
        if (!isToday && user.timeEntries.length < 5) console.log("Entry skipped (not today):", entry.startTime)
        return isToday
    }).reverse()
    console.log("Dashboard: Today Entries", todayEntries.length)

    // Calculate remaining hours for today
    const remainingHours = Math.max(0, user.dailyTarget - stats.todayWorked)

    return (
        <div className="w-full space-y-8">
            {/* Header / Title if needed, or just spacers as per design */}

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                {/* Left: Stats */}
                <StatsWidget
                    extraHours={stats.balance}
                    remainingHours={remainingHours}
                />

                {/* Right: Timer & manual entry */}
                <div className="space-y-4">
                    <ControlBar activeEntry={activeEntry} />
                    <EntryForm />
                </div>
            </div>

            {/* Today List */}
            <div className="pt-8">
                <TodayList entries={todayEntries} />
            </div>
        </div>
    )
}
