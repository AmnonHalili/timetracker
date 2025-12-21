import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getReportData } from "@/lib/report-service"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { CalendarView } from "@/components/calendar/CalendarView"
import { startOfMonth, endOfMonth } from "date-fns"

export default async function CalendarPage({
    searchParams,
}: {
    searchParams: { month?: string; year?: string }
}) {
    const session = await getServerSession(authOptions)
    if (!session) redirect("/login")

    const today = new Date()
    const month = searchParams.month ? parseInt(searchParams.month) : today.getMonth()
    const year = searchParams.year ? parseInt(searchParams.year) : today.getFullYear()

    // Create date object for the first day of the request month
    const currentDate = new Date(year, month, 1)

    // Reuse report logic for daily entries
    const reportData = await getReportData(session.user.id, year, month)

    // Fetch tasks deadline in this month
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)

    // Determine task fetch scope
    const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, projectId: true }
    })

    const whereClause: any = {
        deadline: {
            gte: monthStart,
            lte: monthEnd
        }
    }

    // If Admin and in a project, fetch all project tasks. Otherwise, just own tasks.
    if (currentUser?.role === "ADMIN" && currentUser?.projectId) {
        whereClause.assignedTo = {
            projectId: currentUser.projectId
        }
    } else {
        whereClause.assignedToId = session.user.id
    }

    const tasks = await prisma.task.findMany({
        where: whereClause,
        select: {
            id: true,
            title: true,
            deadline: true,
            priority: true,
            status: true,
            assignedTo: {
                select: {
                    name: true,
                    email: true
                }
            }
        }
    })

    const data = {
        dailyReports: reportData?.report.days || [],
        tasks: tasks
    }

    return (
        <div className="container mx-auto p-4 md:p-8 h-screen-minus-header overflow-hidden flex flex-col">
            <CalendarView initialDate={currentDate} data={data} />
        </div>
    )
}
