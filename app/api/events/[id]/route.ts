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

        const { searchParams } = new URL(req.url)
        const scope = searchParams.get("scope") // 'THIS', 'FUTURE', 'ALL'
        const dateStr = searchParams.get("date") // ISO string for the occurrence being edited

        console.log('[API PATCH Event] Request received:', { eventId: params.id, scope, dateStr })

        const eventId = params.id.includes("_")
            ? params.id.split("_")[0]
            : params.id
        const body = await req.json()

        console.log('[API PATCH] Event body received:', { eventId, scope, dateStr, body })

        // Check if user owns the event
        const existingEvent = await prisma.event.findUnique({
            where: { id: eventId },
            include: { participants: true }
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

        // Handle Scope: FUTURE
        if (scope === "FUTURE" && dateStr && existingEvent.recurrence) {
            // 1. End original event yesterday
            const cutOffDate = new Date(dateStr)
            cutOffDate.setDate(cutOffDate.getDate() - 1)

            await prisma.event.update({
                where: { id: eventId },
                data: { recurrenceEnd: cutOffDate }
            })

            // 2. Create NEW event for future
            // Remove ID from body to create new
            // Ensure startTime is set to the new effective start date
            // 2. Create NEW event for future
            // Remove ID from body to create new
            // Ensure startTime is set to the new effective start date

            // Clean up fields that might be null or undefined if not in body
            // Actually, we should probably construct it carefully merging existing + updates
            const mergedData = {
                title: body.title ?? existingEvent.title,
                description: body.description ?? existingEvent.description,
                startTime: body.startTime ? new Date(body.startTime) : new Date(dateStr), // Start from the selected instance date (or new time)
                endTime: body.endTime ? new Date(body.endTime) : new Date(new Date(dateStr).getTime() + (existingEvent.endTime.getTime() - existingEvent.startTime.getTime())),
                allDay: body.allDay ?? existingEvent.allDay,
                type: body.type ?? existingEvent.type,
                location: body.location ?? existingEvent.location,
                recurrence: body.recurrence ?? existingEvent.recurrence, // Keep recurrence
                recurrenceEnd: body.recurrenceEnd ? new Date(body.recurrenceEnd) : (existingEvent.recurrenceEnd ?? null),
                projectId: existingEvent.projectId, // Keep project association
                createdById: session.user.id
            }

            const newEvent = await prisma.event.create({
                data: {
                    ...mergedData,
                    participants: {
                        create: (body.participantIds || existingEvent.participants.map(p => p.userId)).map((id: string) => ({
                            user: { connect: { id } }
                        }))
                    }
                },
                include: {
                    createdBy: { select: { id: true, name: true, email: true } },
                    participants: { include: { user: { select: { id: true, name: true, email: true } } } }
                }
            })

            return NextResponse.json(newEvent)
        }

        // Handle Scope: THIS
        if (scope === "THIS" && dateStr && existingEvent.recurrence) {
            // 1. Add exception to original event
            const exDate = new Date(dateStr)
            await prisma.event.update({
                where: { id: eventId },
                data: { exDates: { push: exDate } }
            })

            // 2. Create NEW single event
            const mergedData = {
                title: body.title ?? existingEvent.title,
                description: body.description ?? existingEvent.description,
                startTime: body.startTime ? new Date(body.startTime) : new Date(dateStr),
                endTime: body.endTime ? new Date(body.endTime) : new Date(new Date(dateStr).getTime() + (existingEvent.endTime.getTime() - existingEvent.startTime.getTime())),
                allDay: body.allDay ?? existingEvent.allDay,
                type: body.type ?? existingEvent.type,
                location: body.location ?? existingEvent.location,
                recurrence: null, // Break recurrence
                recurrenceEnd: null,
                projectId: existingEvent.projectId, // Keep project association
                createdById: session.user.id
            }

            const newEvent = await prisma.event.create({
                data: {
                    ...mergedData,
                    participants: {
                        create: (body.participantIds || existingEvent.participants.map(p => p.userId)).map((id: string) => ({
                            user: { connect: { id } }
                        }))
                    }
                },
                include: {
                    createdBy: { select: { id: true, name: true, email: true } },
                    participants: { include: { user: { select: { id: true, name: true, email: true } } } }
                }
            })

            return NextResponse.json(newEvent)
        }

        // Handle Scope: ALL (Default fallthrough)
        const updatedEvent = await prisma.event.update({
            where: { id: eventId },
            data: {
                ...(title && { title }),
                ...(description !== undefined && { description }),
                // Calculate new start/end times preserving the series start date
                ...(startTime && (() => {
                    if (dateStr && existingEvent.recurrence) {
                        // Calculate delta between new start time and the occurrence's original start time
                        const originalOccurrenceStart = new Date(dateStr)
                        const newOccurrenceStart = new Date(startTime)
                        const delta = newOccurrenceStart.getTime() - originalOccurrenceStart.getTime()

                        // Apply delta to the SERIES start time
                        return { startTime: new Date(existingEvent.startTime.getTime() + delta) }
                    }
                    return { startTime: new Date(startTime) }
                })()),
                ...(endTime && (() => {
                    if (dateStr && existingEvent.recurrence && startTime) {
                        // Maintain duration
                        const newStart = new Date(startTime)
                        const newEnd = new Date(endTime)
                        const duration = newEnd.getTime() - newStart.getTime()

                        // Re-calculate series start (as above) to get series end
                        const originalOccurrenceStart = new Date(dateStr)
                        const delta = newStart.getTime() - originalOccurrenceStart.getTime()
                        const seriesNewStart = existingEvent.startTime.getTime() + delta

                        return { endTime: new Date(seriesNewStart + duration) }
                    }
                    return { endTime: new Date(endTime) }
                })()),
                ...(allDay !== undefined && { allDay }),
                ...(type && { type: type as EventType }),
                ...(location !== undefined && { location }),
                ...(recurrence !== undefined && { recurrence: recurrence as RecurrenceType | null }),
                ...(recurrenceEnd !== undefined && { recurrenceEnd: recurrenceEnd ? new Date(recurrenceEnd) : null }),
                ...(body.participantIds && {
                    participants: {
                        deleteMany: {},
                        create: body.participantIds.map((id: string) => ({
                            user: { connect: { id } }
                        }))
                    }
                })
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

        console.log('[API PATCH] ALL scope handled - updated event:', { eventId, updatedTitle: updatedEvent.title })
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

        const { searchParams } = new URL(req.url)
        const scope = searchParams.get("scope") // 'THIS', 'FUTURE', 'ALL'
        const dateStr = searchParams.get("date") // ISO string for the occurrence

        let eventId = params.id

        // Handle recurring event instances (synthetic IDs)
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

        // Handle specific scopes for recurring events
        if (scope === "THIS" && dateStr && existingEvent.recurrence) {
            // Add date to exDates
            const exDate = new Date(dateStr)

            // Ensure we don't duplicate dates (though array push is fine, let's just push)
            await prisma.event.update({
                where: { id: eventId },
                data: {
                    exDates: {
                        push: exDate
                    }
                }
            })
            return NextResponse.json({ message: "Occurrence deleted successfully" })

        } else if (scope === "FUTURE" && dateStr && existingEvent.recurrence) {
            // End recurrence before this date
            const cutOffDate = new Date(dateStr)
            cutOffDate.setDate(cutOffDate.getDate() - 1) // One day before

            await prisma.event.update({
                where: { id: eventId },
                data: {
                    recurrenceEnd: cutOffDate
                }
            })
            return NextResponse.json({ message: "Future occurrences deleted successfully" })
        }

        // Default: Delete ALL (entire series)
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
