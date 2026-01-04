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

        // 1. Reports
        const reportData = await getReportData(session.user.id, year, month)

        // 2. Fetch User & determine scope
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { calendarSettings: true, project: true } // Fetch settings and project
        })

        // 3. Tasks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const taskWhereClause: any = {
            deadline: {
                gte: monthStart,
                lte: monthEnd
            }
        }

        if (currentUser?.role === "ADMIN" && currentUser?.projectId) {
            taskWhereClause.assignees = {
                some: {
                    projectId: currentUser.projectId
                }
            }
        } else {
            taskWhereClause.assignees = {
                some: {
                    id: session.user.id
                }
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tasks = await (prisma as any).task.findMany({
            where: taskWhereClause,
            select: {
                id: true,
                title: true,
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

        // 4. Internal Events
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eventWhereClause: any = {
            startTime: { gte: monthStart },
            endTime: { lte: monthEnd },
            participants: { some: { userId: session.user.id } }
        }

        if (currentUser?.projectId) {
            eventWhereClause.projectId = currentUser.projectId
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const internalEvents = await (prisma as any).event.findMany({
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

        let allEvents = [...internalEvents]

        // 5. Google Calendar Sync
        if (currentUser?.calendarSettings?.isGoogleCalendarSyncEnabled) {
            console.log(`[API] Google Sync Enabled. Fetching events...`)
            try {
                // Check cache first (Simple cache: if lastSyncedAt < 5 mins ago, use cached events)
                // NOTE: For now, we are skipping complex cache logic and just fetching fresh data for reliability
                // But we will use the `getValidGoogleClient` which handles token refresh efficiently.

                const calendar = await getValidGoogleClient(session.user.id)

                // Fetch events
                // Note: timeMin/timeMax need to be RFC3339 strings
                const googleRes = await calendar.events.list({
                    calendarId: 'primary',
                    timeMin: monthStart.toISOString(),
                    timeMax: monthEnd.toISOString(),
                    singleEvents: true,
                    orderBy: 'startTime'
                })

                console.log(`[API] Google Events fetched:`, googleRes.data.items?.length)

                const googleEvents = googleRes.data.items || []

                // Transform Google Events to internal format
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

                allEvents = [...allEvents, ...transformedGoogleEvents]

                // Ideally update lastSyncedAt here without blocking
                /*
                await prisma.calendarSettings.update({
                    where: { userId: session.user.id },
                    data: { lastSyncedAt: new Date() }
                })
                */

            } catch (error) {
                console.error("Failed to sync Google Calendar:", error)
                // Don't fail the whole request, just log and continue with internal events
            }
        }

        return NextResponse.json({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dailyReports: (reportData as any)?.report?.days || [],
            tasks,
            events: allEvents
        })
    } catch (error) {
        console.error("Error fetching calendar data:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
