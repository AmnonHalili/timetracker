import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getReportData } from "@/lib/report-service"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { startOfMonth, endOfMonth } from "date-fns"
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
            console.log(`[API] Google Sync Enabled.Fetching events...`)
            try {
                const calendar = await getValidGoogleClient(session.user.id)
                const calendarIds = currentUser.calendarSettings.syncedCalendarIds.length > 0
                    ? currentUser.calendarSettings.syncedCalendarIds
                    : ['primary']

                console.log(`[API] Fetching from calendars: `, calendarIds)

                const calendarPromises = calendarIds.map(async (calendarId) => {
                    try {
                        const googleRes = await calendar.events.list({
                            calendarId,
                            timeMin: monthStart.toISOString(),
                            timeMax: monthEnd.toISOString(),
                            singleEvents: true,
                            orderBy: 'startTime'
                        })

                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        return (googleRes.data.items || []).map((gEvent: any) => {
                            const isBusyOnly = currentUser.calendarSettings?.syncMode === 'BUSY_ONLY'
                            return {
                                id: gEvent.id,
                                title: isBusyOnly ? 'Busy' : (gEvent.summary || '(No Title)'),
                                description: isBusyOnly ? null : gEvent.description,
                                startTime: gEvent.start?.dateTime || gEvent.start?.date,
                                endTime: gEvent.end?.dateTime || gEvent.end?.date,
                                allDay: !gEvent.start?.dateTime,
                                type: 'EXTERNAL',
                                location: isBusyOnly ? null : gEvent.location,
                                isExternal: true,
                                source: 'google',
                                calendarId: calendarId // Add source calendar ID
                            }
                        })
                    } catch (err) {
                        console.error(`[API] Failed to fetch events for calendar ${calendarId}: `, err)
                        return []
                    }
                })

                const results = await Promise.all(calendarPromises)
                const allGoogleEvents = results.flat()

                console.log(`[API] Total Google Events fetched: `, allGoogleEvents.length)

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                allEvents = [...allEvents, ...(allGoogleEvents as any)]

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
