import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { EventType, RecurrenceType } from "@prisma/client"
import { createNotification } from "@/lib/create-notification"

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

        const eventId = params.id.includes("_")
            ? params.id.split("_")[0]
            : params.id
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

        // ... existing code ...

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

        // Check if time changed and notify participants
        const timeChanged =
            (startTime && new Date(startTime).getTime() !== existingEvent.startTime.getTime()) ||
            (endTime && new Date(endTime).getTime() !== existingEvent.endTime.getTime())

        if (timeChanged) {
            const formattedDate = new Date(updatedEvent.startTime).toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric'
            })

            // Notify all participants except the editor
            const notifications = updatedEvent.participants
                .filter(p => p.user.id !== session.user.id)
                .map(p => createNotification({
                    userId: p.user.id,
                    title: "📅 Event Rescheduled",
                    message: `The event "${updatedEvent.title}" has been rescheduled to ${formattedDate}.`,
                    link: "/calendar",
                    type: "INFO"
                }))

            await Promise.allSettled(notifications)
        }

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

        let eventId = params.id

        // Handle recurring event instances (synthetic IDs like cuid_timestamp)
        // If we receive a synthetic ID, we want to operate on the original event series
        if (eventId.includes("_")) {
            eventId = eventId.split("_")[0]
        }

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
