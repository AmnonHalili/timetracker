import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getReportData } from "@/lib/report-service"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { startOfMonth, endOfMonth, parseISO } from "date-fns"
import { getValidGoogleClient } from "@/lib/google-calendar"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const month = parseInt(searchParams.get("month") || "")
        const year = parseInt(searchParams.get("year") || "")

        if (isNaN(month) || isNaN(year)) {
            return NextResponse.json({ error: "Invalid date params" }, { status: 400 })
        }

        const currentDate = new Date(year, month, 1)
        const monthStart = startOfMonth(currentDate)
        const monthEnd = endOfMonth(currentDate)

        // Execute independent queries in parallel
        const [reportData, currentUser, tasks, internalEvents] = await Promise.all([
            // 1. Reports
            getReportData(session.user.id, year, month),

            // 2. User & Scope
            prisma.user.findUnique({
                where: { id: session.user.id },
                include: { calendarSettings: true, project: true }
            }),

            // 3. Tasks - query needs logic based on user role/project, so we defer the specific query construction
            // Actually, we need currentUser to construct the task query... 
            // So we can't fully parallelize tasks/events without currentUser.
            // Let's parallelize Reports and User first, then the rest.
            // Wait, to be truly parallel we need to assume global strategy or fetch user first fast.
            // Let's keep it simple: Fetch User first (fast), then everything else parallel.
            null, null
        ]);

        // Re-fetching user here to respect the variable scope flow, but optimization:
        // We know we need currentUser for tasks/events permissions.
        // So step 1: Fetch User + Reports (independent)

        const [reportDataResult, currentUserResult] = await Promise.all([
            getReportData(session.user.id, year, month),
            prisma.user.findUnique({
                where: { id: session.user.id },
                include: { calendarSettings: true, project: true }
            })
        ])

        // 3. Tasks Logic
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const taskWhereClause: any = {
            deadline: {
                gte: monthStart,
                lte: monthEnd
            }
        }

        if (currentUserResult?.role === "ADMIN" && currentUserResult?.projectId) {
            taskWhereClause.assignees = {
                some: {
                    projectId: currentUserResult.projectId
                }
            }
        } else {
            taskWhereClause.assignees = {
                some: {
                    id: session.user.id
                }
            }
        }

        // 4. Internal Events Logic
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eventWhereClause: any = {
            startTime: { gte: monthStart },
            endTime: { lte: monthEnd },
            participants: { some: { userId: session.user.id } }
        }

        if (currentUserResult?.projectId) {
            eventWhereClause.projectId = currentUserResult.projectId
        }


        // Execute Data Fetching Parallel
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [tasksResult, internalEventsResult, googleEventsResult] = await Promise.all([
            (prisma as any).task.findMany({
                where: taskWhereClause,
                select: {
                    id: true, title: true, deadline: true, priority: true, status: true, description: true,
                    assignees: { select: { name: true, email: true } }
                }
            }),
            (prisma as any).event.findMany({
                where: eventWhereClause,
                select: {
                    id: true, title: true, description: true, startTime: true, endTime: true, allDay: true, type: true, location: true,
                    createdBy: { select: { id: true, name: true, email: true } },
                    participants: { include: { user: { select: { id: true, name: true, email: true } } } }
                },
                orderBy: { startTime: 'asc' }
            }),
            // Google Events (Cached)
            (async () => {
                if (currentUserResult?.calendarSettings?.isGoogleCalendarSyncEnabled) {
                    const { getCachedGoogleEvents } = await import("@/lib/google-data")
                    const calendarIds = currentUserResult.calendarSettings.syncedCalendarIds.length > 0
                        ? currentUserResult.calendarSettings.syncedCalendarIds
                        : ['primary']

                    // Generate a unique cache key based on params
                    // unstable_cache arguments: (userId, start, end, calendarIds, mode)
                    return getCachedGoogleEvents(
                        session.user.id,
                        monthStart.toISOString(),
                        monthEnd.toISOString(),
                        calendarIds,
                        currentUserResult.calendarSettings.syncMode || 'FULL_DETAILS'
                    )
                }
                return []
            })()
        ])

        const allEvents = [...internalEventsResult, ...(googleEventsResult || [])]

        return NextResponse.json({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dailyReports: (reportDataResult as any)?.report?.days || [],
            tasks: tasksResult,
            events: allEvents
        })
    } catch (error) {
        console.error("Error fetching calendar data:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
