import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { EventType, RecurrenceType, Prisma } from "@prisma/client"

// POST - Create new event
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const {
            title,
            description,
            startTime,
            endTime,
            allDay = false,
            type = "MEETING" as EventType,
            location,
            projectId,
            participantIds = [],
            reminderMinutes = [],
            recurrence,
            recurrenceEnd
        } = body

        // Validation
        if (!title || !startTime || !endTime) {
            return NextResponse.json(
                { error: "Title, startTime, and endTime are required" },
                { status: 400 }
            )
        }

        // Create event
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                role: true,
                _count: { select: { directReports: true } }
            }
        })

        const canManageOthers =
            user?.role === 'ADMIN' ||
            user?.role === 'MANAGER' ||
            (user?._count?.directReports ?? 0) > 0

        const hasOtherParticipants = participantIds.some((id: string) => id !== session.user.id)

        if (!canManageOthers && hasOtherParticipants) {
            return NextResponse.json(
                { error: "You do not have permission to invite other participants." },
                { status: 403 }
            )
        }

        const event = await prisma.event.create({
            data: {
                title,
                description,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                allDay,
                type,
                location,
                projectId: projectId || session.user.projectId, // Use provided or fallback to active
                createdById: session.user.id,
                recurrence: recurrence as RecurrenceType | null,
                recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : null,
                participants: {
                    create: participantIds.map((userId: string) => ({
                        userId,
                        status: userId === session.user.id ? "ACCEPTED" : "PENDING"
                    }))
                },
                reminders: {
                    create: reminderMinutes.map((minutes: number) => ({
                        minutesBefore: minutes,
                        sent: false
                    }))
                }
            },
            include: {
                createdBy: {
                    select: { id: true, name: true, email: true }
                },
                participants: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true }
                        }
                    }
                },
                reminders: true
            }
        })

        return NextResponse.json(event, { status: 201 })
    } catch (error) {
        console.error("Error creating event:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

// GET - Fetch events for date range
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const startDate = searchParams.get("startDate")
        const endDate = searchParams.get("endDate")
        const projectId = searchParams.get("projectId")

        if (!startDate || !endDate) {
            return NextResponse.json(
                { error: "startDate and endDate are required" },
                { status: 400 }
            )
        }

        // Build where clause
        const where: Prisma.EventWhereInput = {
            startTime: {
                gte: new Date(startDate)
            },
            endTime: {
                lte: new Date(endDate)
            },
            participants: { some: { userId: session.user.id } }
        }

        // Strictly filter by projectId (from session/user, not just query param)
        // If query param projectId is different from session.user.projectId, it might be unauthorized if we enforce strict checking.
        // For now, let's prioritize the session project ID if the user is scoped to one.
        if (session.user.projectId) {
            where.projectId = session.user.projectId
        } else if (projectId) {
            // Fallback for admins or users without strict project scope (if applicable), though our new logic says everyone has one active project.
            where.projectId = projectId
        }

        const events = await prisma.event.findMany({
            where,
            include: {
                createdBy: {
                    select: { id: true, name: true, email: true }
                },
                participants: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true }
                        }
                    }
                },
                reminders: true
            },
            orderBy: {
                startTime: 'asc'
            }
        })

        return NextResponse.json(events)
    } catch (error) {
        console.error("Error fetching events:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
