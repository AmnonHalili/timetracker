import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getReportData } from "@/lib/report-service"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { CalendarView } from "@/components/calendar/CalendarView"
import { startOfMonth, endOfMonth } from "date-fns"

export const dynamic = "force-dynamic"
export const revalidate = 0

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
        select: { role: true, projectId: true, calendarSettings: true }
    })

    // Tasks are active in this month if:
    // 1. deadline is in this month, OR
    // 2. startDate is in this month, OR
    // 3. startDate is before month and deadline is after month (task spans the month), OR
    // 4. Only deadline exists and is in this month, OR
    // 5. Only startDate exists and is in this month or before
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
        OR: [
            // Deadline in this month
            { deadline: { gte: monthStart, lte: monthEnd } },
            // StartDate in this month
            { startDate: { gte: monthStart, lte: monthEnd } },
            // Task spans the month (startDate before, deadline after)
            {
                AND: [
                    { startDate: { lte: monthEnd } },
                    { deadline: { gte: monthStart } }
                ]
            },
            // Only deadline (no startDate) in this month
            {
                AND: [
                    { deadline: { gte: monthStart, lte: monthEnd } },
                    { startDate: null }
                ]
            },
            // Only startDate (no deadline) in this month or before
            {
                AND: [
                    { startDate: { lte: monthEnd } },
                    { deadline: null }
                ]
            }
        ]
    }

    // If Admin and in a project, fetch all project tasks. Otherwise, just own tasks.
    if (currentUser?.role === "ADMIN" && currentUser?.projectId) {
        whereClause.assignees = {
            some: {
                projectId: currentUser.projectId
            }
        }
    } else {
        whereClause.assignees = {
            some: {
                id: session.user.id
            }
        }
    }

    const tasks = await prisma.task.findMany({
        where: whereClause,
        select: {
            id: true,
            title: true,
            startDate: true,
            deadline: true,
            priority: true,
            status: true,
            description: true,
            assignees: {
                select: {
                    name: true,
                    email: true
                }
            }
        }
    })

    // Fetch events for this month
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventWhereClause: any = {
        startTime: { gte: monthStart },
        endTime: { lte: monthEnd },
        participants: { some: { userId: session.user.id } }
    }

    // Optionally filter by project
    if (currentUser?.projectId) {
        eventWhereClause.projectId = currentUser.projectId
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = await (prisma as any).event.findMany({
        where: eventWhereClause,
        select: {
            id: true,
            title: true,
            description: true,
            startTime: true,
            endTime: true,
            allDay: true,
            type: true,
            location: true,
            createdBy: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            },
            participants: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            }
        },
        orderBy: {
            startTime: 'asc'
        }
    })

    let allEvents = [...events]

    // Google Calendar Sync
    if (currentUser?.calendarSettings?.isGoogleCalendarSyncEnabled) {
        console.log(`[SSR] Google Sync Enabled. Fetching events...`)
        try {
            const { getValidGoogleClient } = await import("@/lib/google-calendar")
            const calendar = await getValidGoogleClient(session.user.id)

            // Fetch events
            const googleRes = await calendar.events.list({
                calendarId: 'primary',
                timeMin: monthStart.toISOString(),
                timeMax: monthEnd.toISOString(),
                singleEvents: true,
                orderBy: 'startTime'
            })

            console.log(`[SSR] Google Events fetched:`, googleRes.data.items?.length)

            const googleEvents = googleRes.data.items || []

            // Transform Google Events to internal format
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const transformedGoogleEvents = googleEvents.map((gEvent: any) => {
                const isBusyOnly = currentUser.calendarSettings?.syncMode === 'BUSY_ONLY'

                return {
                    id: gEvent.id,
                    title: isBusyOnly ? 'Busy' : (gEvent.summary || '(No Title)'),
                    description: isBusyOnly ? null : gEvent.description,
                    startTime: gEvent.start?.dateTime || gEvent.start?.date,
                    endTime: gEvent.end?.dateTime || gEvent.end?.date,
                    allDay: !gEvent.start?.dateTime, // If no dateTime, it's an all-day event
                    type: 'EXTERNAL', // Special type for frontend styling
                    location: isBusyOnly ? null : gEvent.location,
                    isExternal: true, // Flag for frontend
                    source: 'google'
                }
            })

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            allEvents = [...allEvents, ...(transformedGoogleEvents as any)]

        } catch (error) {
            console.error("Failed to sync Google Calendar (SSR):", error)
        }
    }

    const data = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dailyReports: (reportData as any)?.report?.days || [],
        tasks: tasks,
        events: allEvents
    }

    return (
        <div className="container mx-auto p-4 md:p-8 h-screen-minus-header overflow-hidden flex flex-col">
            <CalendarView initialDate={currentDate} data={data} projectId={currentUser?.projectId || null} />
        </div>
    )
}
