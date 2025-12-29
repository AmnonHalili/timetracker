import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

/**
 * API endpoint to handle automatic breaks when user leaves work area
 * This is called by the client when location monitoring detects user left the area
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const { location, reason = "left_work_area" } = await req.json()

        // Find active time entry
        const activeEntry = await prisma.timeEntry.findFirst({
            where: {
                userId: session.user.id,
                endTime: null,
            },
            select: {
                id: true,
                userId: true,
                startTime: true,
                endTime: true,
                description: true,
                isManual: true,
                createdAt: true,
                updatedAt: true,
                subtaskId: true,
                locationRequired: true,
                startLocationLat: true,
                startLocationLng: true,
                startLocationVerified: true,
                endLocationLat: true,
                endLocationLng: true,
                endLocationVerified: true,
                locationStatus: true,
                breaks: true
            },
        })

        if (!activeEntry) {
            return NextResponse.json({ message: "No active work session" }, { status: 400 })
        }

        // Check if already on break
        const activeBreak = activeEntry.breaks.find(b => b.endTime === null)
        if (activeBreak) {
            // Already on break, just update location if provided
            if (location) {
                await prisma.timeBreak.update({
                    where: { id: activeBreak.id },
                    data: {
                        locationLat: location.latitude,
                        locationLng: location.longitude,
                    },
                })
            }
            return NextResponse.json({ message: "Already on break", break: activeBreak })
        }

        // Create new break
        const newBreak = await prisma.timeBreak.create({
            data: {
                timeEntryId: activeEntry.id,
                startTime: new Date(),
                reason,
                locationLat: location?.latitude || null,
                locationLng: location?.longitude || null,
            },
        })

        return NextResponse.json({ break: newBreak, message: "Break started" })
    } catch (error) {
        console.error("Error creating break:", error)
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 })
    }
}

/**
 * Resume work when user returns to work area
 */
export async function PATCH() {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        // Find active time entry with open break
        const activeEntry = await prisma.timeEntry.findFirst({
            where: {
                userId: session.user.id,
                endTime: null,
            },
            select: {
                id: true,
                userId: true,
                startTime: true,
                endTime: true,
                description: true,
                isManual: true,
                createdAt: true,
                updatedAt: true,
                subtaskId: true,
                locationRequired: true,
                startLocationLat: true,
                startLocationLng: true,
                startLocationVerified: true,
                endLocationLat: true,
                endLocationLng: true,
                endLocationVerified: true,
                locationStatus: true,
                breaks: true
            },
        })

        if (!activeEntry) {
            return NextResponse.json({ message: "No active work session" }, { status: 400 })
        }

        // Find open break
        const activeBreak = activeEntry.breaks.find(b => b.endTime === null)
        if (!activeBreak) {
            return NextResponse.json({ message: "No active break" }, { status: 400 })
        }

        // End the break
        await prisma.timeBreak.update({
            where: { id: activeBreak.id },
            data: {
                endTime: new Date(),
            },
        })

        return NextResponse.json({ message: "Break ended, work resumed" })
    } catch (error) {
        console.error("Error ending break:", error)
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 })
    }
}

