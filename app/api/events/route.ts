import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { EventType, RecurrenceType } from "@prisma/client"

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
        const event = await prisma.event.create({
            data: {
                title,
                description,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                allDay,
                type,
                location,
                projectId,
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
        const where: any = {
            startTime: {
                gte: new Date(startDate)
            },
            endTime: {
                lte: new Date(endDate)
            },
            OR: [
                { createdById: session.user.id },
                { participants: { some: { userId: session.user.id } } }
            ]
        }

        if (projectId) {
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
