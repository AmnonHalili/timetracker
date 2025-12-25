import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { EventType, RecurrenceType } from "@prisma/client"

// PATCH - Update event
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const eventId = params.id
        const body = await req.json()

        // Check if user owns the event
        const existingEvent = await prisma.event.findUnique({
            where: { id: eventId }
        })

        if (!existingEvent) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 })
        }

        if (existingEvent.createdById !== session.user.id) {
            return NextResponse.json(
                { error: "You can only edit your own events" },
                { status: 403 }
            )
        }

        // Update event
        const {
            title,
            description,
            startTime,
            endTime,
            allDay,
            type,
            location,
            recurrence,
            recurrenceEnd
        } = body

        const updatedEvent = await prisma.event.update({
            where: { id: eventId },
            data: {
                ...(title && { title }),
                ...(description !== undefined && { description }),
                ...(startTime && { startTime: new Date(startTime) }),
                ...(endTime && { endTime: new Date(endTime) }),
                ...(allDay !== undefined && { allDay }),
                ...(type && { type: type as EventType }),
                ...(location !== undefined && { location }),
                ...(recurrence !== undefined && { recurrence: recurrence as RecurrenceType | null }),
                ...(recurrenceEnd !== undefined && { recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : null })
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

        return NextResponse.json(updatedEvent)
    } catch (error) {
        console.error("Error updating event:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

// DELETE - Delete event
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const eventId = params.id

        // Check if user owns the event
        const existingEvent = await prisma.event.findUnique({
            where: { id: eventId }
        })

        if (!existingEvent) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 })
        }

        if (existingEvent.createdById !== session.user.id) {
            return NextResponse.json(
                { error: "You can only delete your own events" },
                { status: 403 }
            )
        }

        // Delete event (participants and reminders cascade)
        await prisma.event.delete({
            where: { id: eventId }
        })

        return NextResponse.json({ message: "Event deleted successfully" })
    } catch (error) {
        console.error("Error deleting event:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
