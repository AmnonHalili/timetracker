import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { calculateDistance } from "@/lib/gps-utils"

// GET: Fetch currently running entry + recent history
export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const entries = await prisma.timeEntry.findMany({
            where: { userId: session.user.id },
            include: { breaks: true, tasks: true }, // Updated relation
            orderBy: { createdAt: 'desc' }, // Updated orderBy
            take: 50, // Limit to recent 50 for dashboard performance
        })

        // The instruction implies returning only entries, but the original code also returned activeEntry.
        // To maintain existing client-side expectations for activeEntry, we'll keep it.
        const activeEntry = entries.find(e => e.endTime === null)

        return NextResponse.json({ entries, activeEntry })
    } catch {
        return NextResponse.json({ message: "Error fetching entries" }, { status: 500 })
    }
}

// POST: Toggle Timer (Start/Stop/Pause/Resume) or Create Manual Entry
export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { action, manualData, taskIds, description, subtaskId, location }: {
        action: 'start' | 'stop' | 'pause' | 'resume' | 'manual',
        manualData?: Record<string, unknown>,
        taskIds?: string[],
        description?: string,
        subtaskId?: string | null,
        location?: { latitude: number; longitude: number } | null
    } = await req.json()

    try {
        // 1. START TIMER
        if (action === "start") {
            const active = await prisma.timeEntry.findFirst({
                where: { userId: session.user.id, endTime: null }
            })

            if (active) {
                return NextResponse.json({ message: "Timer already running" }, { status: 400 })
            }

            // Check if work location is required
            const user = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { projectId: true },
            })

            let locationRequired = false
            let locationStatus = "not_required"
            let startLocationVerified = false

            if (user?.projectId) {
                const project = await prisma.project.findUnique({
                    where: { id: user.projectId },
                    select: {
                        workLocationLatitude: true,
                        workLocationLongitude: true,
                        workLocationRadius: true,
                        isRemoteWork: true,
                    },
                })

                // Only require location if not remote work and location is set
                if (!project?.isRemoteWork && project?.workLocationLatitude && project?.workLocationLongitude) {
                    locationRequired = true
                    if (location) {
                        // Verify location using Haversine formula
                        const distance = calculateDistance(
                            location.latitude,
                            location.longitude,
                            project.workLocationLatitude,
                            project.workLocationLongitude
                        )

                        if (distance <= (project.workLocationRadius || 150)) {
                            locationStatus = "verified"
                            startLocationVerified = true
                        } else {
                            locationStatus = "outside_area"
                        }
                    } else {
                        locationStatus = "unavailable"
                    }
                }
            }

            const newEntry = await prisma.timeEntry.create({
                data: {
                    userId: session.user.id,
                    startTime: new Date(),
                    description,
                    isManual: false,
                    tasks: taskIds && taskIds.length > 0 ? {
                        connect: taskIds.map(id => ({ id }))
                    } : undefined,
                    subtaskId: subtaskId || null,
                    locationRequired,
                    startLocationLat: location?.latitude || null,
                    startLocationLng: location?.longitude || null,
                    startLocationVerified,
                    locationStatus,
                }
            })

            return NextResponse.json({ entry: newEntry })
        }

        // 2. STOP TIMER
        if (action === "stop") {
            const active = await prisma.timeEntry.findFirst({
                where: { userId: session.user.id, endTime: null },
                include: { breaks: true }
            })

            if (!active) {
                return NextResponse.json({ message: "No active timer found" }, { status: 400 })
            }

            // Close any open breaks
            const activeBreak = active.breaks.find(b => b.endTime === null)
            if (activeBreak) {
                await prisma.timeBreak.update({
                    where: { id: activeBreak.id },
                    data: { endTime: new Date() }
                })
            }

            // Update location if provided
            let endLocationVerified = false
            if (location && active.locationRequired) {
                const user = await prisma.user.findUnique({
                    where: { id: session.user.id },
                    select: { projectId: true },
                })

                if (user?.projectId) {
                    const project = await prisma.project.findUnique({
                        where: { id: user.projectId },
                        select: {
                            workLocationLatitude: true,
                            workLocationLongitude: true,
                            workLocationRadius: true,
                            isRemoteWork: true,
                        },
                    })

                    // Only verify location if not remote work and location is set
                    if (!project?.isRemoteWork && project?.workLocationLatitude && project?.workLocationLongitude) {
                        const distance = calculateDistance(
                            location.latitude,
                            location.longitude,
                            project.workLocationLatitude,
                            project.workLocationLongitude
                        )

                        if (distance <= (project.workLocationRadius || 150)) {
                            endLocationVerified = true
                        }
                    }
                }
            }

            const updated = await prisma.timeEntry.update({
                where: { id: active.id },
                data: {
                    endTime: new Date(),
                    endLocationLat: location?.latitude || null,
                    endLocationLng: location?.longitude || null,
                    endLocationVerified,
                }
            })

            return NextResponse.json({ entry: updated })
        }

        // 3. PAUSE TIMER
        if (action === "pause") {
            const active = await prisma.timeEntry.findFirst({
                where: { userId: session.user.id, endTime: null },
                include: { breaks: true }
            })

            if (!active) {
                return NextResponse.json({ message: "No active timer found" }, { status: 400 })
            }

            // Check if already paused
            const activeBreak = active.breaks.find(b => b.endTime === null)
            if (activeBreak) {
                return NextResponse.json({ message: "Timer already paused" }, { status: 400 })
            }

            await prisma.timeBreak.create({
                data: {
                    timeEntryId: active.id,
                    startTime: new Date()
                }
            })

            return NextResponse.json({ message: "Paused" })
        }

        // 4. RESUME TIMER
        if (action === "resume") {
            const active = await prisma.timeEntry.findFirst({
                where: { userId: session.user.id, endTime: null },
                include: { breaks: true }
            })

            if (!active) {
                return NextResponse.json({ message: "No active timer found" }, { status: 400 })
            }

            const activeBreak = active.breaks.find(b => b.endTime === null)
            if (!activeBreak) {
                return NextResponse.json({ message: "Timer is not paused" }, { status: 400 })
            }

            await prisma.timeBreak.update({
                where: { id: activeBreak.id },
                data: { endTime: new Date() }
            })

            return NextResponse.json({ message: "Resumed" })
        }

        // 5. MANUAL ENTRY
        if (action === "manual") {
            console.log("API: Creating manual entry", manualData)
            const { start, end, description } = manualData as { start: string; end: string; description?: string }
            const entry = await prisma.timeEntry.create({
                data: {
                    userId: session.user.id,
                    startTime: new Date(start),
                    endTime: new Date(end),
                    description,
                    isManual: true,
                    tasks: taskIds && taskIds.length > 0 ? {
                        connect: taskIds.map(id => ({ id }))
                    } : undefined,
                    subtaskId: subtaskId || null,
                }
            })
            console.log("API: Created entry", entry.id)
            return NextResponse.json({ entry })
        }

        return NextResponse.json({ message: "Invalid action" }, { status: 400 })

    } catch (error) {
        console.error(error)
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 })
    }
}

// PATCH: Update entry (e.g. description)
export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const payload = await req.json() as { id: string; description?: string; startTime?: string; endTime?: string; taskIds?: string[]; subtaskId?: string | null }
    const { id, description, startTime, endTime, taskIds, subtaskId } = payload

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {}
        if (description !== undefined) data.description = description
        if (taskIds !== undefined) {
            data.tasks = {
                set: taskIds.map(tid => ({ id: tid }))
            }
        }
        if (subtaskId !== undefined) data.subtaskId = subtaskId

        if (startTime) {
            data.startTime = new Date(startTime)
            data.isManual = true
        }
        if (endTime) {
            data.endTime = new Date(endTime)
            data.isManual = true
        }

        const updated = await prisma.timeEntry.update({
            where: { id },
            data
        })

        return NextResponse.json({ entry: updated })
    } catch {
        return NextResponse.json({ message: "Error updating entry" }, { status: 500 })
    }
}

// DELETE: Delete entry
export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!session || !session.user || !id) {
        return NextResponse.json({ message: "Unauthorized or missing ID" }, { status: 401 })
    }

    try {
        await prisma.timeEntry.delete({
            where: { id }
        })

        return NextResponse.json({ message: "Deleted" })
    } catch {
        return NextResponse.json({ message: "Error deleting entry" }, { status: 500 })
    }
}
