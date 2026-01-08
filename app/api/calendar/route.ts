import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getReportData } from "@/lib/report-service"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { startOfMonth, endOfMonth } from "date-fns"

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

        // 1. Fetch User & Reports Parallel (Independent)

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (prisma as any).task.findMany({
                where: taskWhereClause,
                select: {
                    id: true, title: true, deadline: true, priority: true, status: true, description: true,
                    assignees: { select: { name: true, email: true } }
                }
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (prisma as any).event.findMany({
                where: {
                    participants: { some: { userId: session.user.id } },
                    ...(currentUserResult?.projectId ? { projectId: currentUserResult.projectId } : {}),
                    OR: [
                        {
                            // Normal events in range
                            startTime: { gte: monthStart },
                            endTime: { lte: monthEnd },
                            recurrence: null
                        },
                        {
                            // Recurring events active during this period
                            recurrence: { not: null },
                            startTime: { lte: monthEnd },
                            OR: [
                                { recurrenceEnd: null },
                                { recurrenceEnd: { gte: monthStart } }
                            ]
                        }
                    ]
                },
                select: {
                    id: true, title: true, description: true, startTime: true, endTime: true, allDay: true, type: true, location: true,
                    recurrence: true, recurrenceEnd: true,
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

        // EXPAND RECURRING EVENTS
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const expandedEvents: any[] = []

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        internalEventsResult.forEach((event: any) => {
            if (!event.recurrence) {
                expandedEvents.push(event)
                return
            }

            // Expand logic
            const duration = event.endTime.getTime() - event.startTime.getTime()
            const current = new Date(event.startTime)

            // If infinite, cap at query range end. Note: We only need to generate up to monthEnd for this view.
            // But we must check against recurrenceEnd if it exists.
            const limit = event.recurrenceEnd
                ? (event.recurrenceEnd < monthEnd ? event.recurrenceEnd : monthEnd)
                : monthEnd

            // Simple loop expansion
            // Optimization: If start is far back, we should jump ahead, but simplistic is fine for typical use.
            while (current <= limit) {
                const currentEnd = new Date(current.getTime() + duration)

                // Check overlap with month window [monthStart, monthEnd]
                // Event interval: [current, currentEnd]
                // Window interval: [monthStart, monthEnd]
                // Overlap if: current < monthEnd && currentEnd > monthStart
                if (current < monthEnd && currentEnd > monthStart) {
                    expandedEvents.push({
                        ...event,
                        id: `${event.id}_${current.getTime()}`, // Synthetic ID
                        startTime: new Date(current),
                        endTime: new Date(currentEnd),
                        originalId: event.id
                    })
                }

                // Advance
                if (event.recurrence === 'DAILY') {
                    current.setDate(current.getDate() + 1)
                } else if (event.recurrence === 'WEEKLY') {
                    current.setDate(current.getDate() + 7)
                } else if (event.recurrence === 'MONTHLY') {
                    current.setMonth(current.getMonth() + 1)
                } else {
                    break // Should not happen
                }
            }
        })

        const allEvents = [...expandedEvents, ...(googleEventsResult || [])]

        return NextResponse.json({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dailyReports: (reportDataResult as any)?.report?.days || [],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tasks: tasksResult,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            events: allEvents
        })
    } catch (error) {
        console.error("Error fetching calendar data:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
