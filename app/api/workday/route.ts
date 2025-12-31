import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { calculateDistance } from "@/lib/gps-utils"
import { startOfDay, endOfDay } from "date-fns"

// GET: Fetch active workday for today
export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const today = new Date()
        const dayStart = startOfDay(today)
        const dayEnd = endOfDay(today)

        let activeWorkday
        try {
            activeWorkday = await prisma.workday.findFirst({
                where: {
                    userId: session.user.id,
                    workdayStartTime: {
                        gte: dayStart,
                        lte: dayEnd,
                    },
                    workdayEndTime: null, // Active workday
                },
                select: {
                    id: true,
                    userId: true,
                    workdayStartTime: true,
                    workdayEndTime: true,
                    locationStatus: true,
                    locationRequired: true,
                },
            })
        } catch (modelError) {
            // Workday model doesn't exist yet - return null
            console.warn("Workday model not available:", modelError)
            return NextResponse.json({ workday: null })
        }

        return NextResponse.json({ workday: activeWorkday })
    } catch (error) {
        console.error("Error fetching workday:", error)
        return NextResponse.json({ workday: null })
    }
}

// POST: Start or End Workday
export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { action, location }: {
        action: 'start' | 'end',
        location?: { latitude: number; longitude: number } | null
    } = await req.json()

    try {
        if (action === "start") {
            // Check if there's already an active workday today
            const today = new Date()
            const dayStart = startOfDay(today)
            const dayEnd = endOfDay(today)

            let activeWorkday
            try {
                activeWorkday = await prisma.workday.findFirst({
                    where: {
                        userId: session.user.id,
                        workdayStartTime: {
                            gte: dayStart,
                            lte: dayEnd,
                        },
                        workdayEndTime: null,
                    },
                    select: {
                        id: true,
                    },
                })
            } catch (modelError) {
                // Workday model doesn't exist yet
                console.warn("Workday model not available:", modelError)
                return NextResponse.json(
                    { message: "Workday feature not available yet. Please run: npx prisma db push --accept-data-loss && npx prisma generate" },
                    { status: 503 }
                )
            }

            if (activeWorkday) {
                return NextResponse.json({ message: "Workday already started" }, { status: 400 })
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
                            return NextResponse.json(
                                { message: "You are outside the work area" },
                                { status: 403 }
                            )
                        }
                    } else {
                        locationStatus = "unavailable"
                    }
                }
            }

            let newWorkday
            try {
                newWorkday = await prisma.workday.create({
                    data: {
                        userId: session.user.id,
                        workdayStartTime: new Date(),
                        locationRequired,
                        startLocationLat: location?.latitude || null,
                        startLocationLng: location?.longitude || null,
                        startLocationVerified,
                        locationStatus,
                    },
                    select: {
                        id: true,
                        workdayStartTime: true,
                        locationStatus: true,
                    },
                })
            } catch (modelError) {
                // Workday model doesn't exist yet
                console.warn("Workday model not available:", modelError)
                return NextResponse.json(
                    { message: "Workday feature not available yet. Please run: npx prisma db push --accept-data-loss && npx prisma generate" },
                    { status: 503 }
                )
            }

            return NextResponse.json({ workday: newWorkday })
        }

        if (action === "end") {
            // Find active workday today
            const today = new Date()
            const dayStart = startOfDay(today)
            const dayEnd = endOfDay(today)

            let activeWorkday
            try {
                activeWorkday = await prisma.workday.findFirst({
                    where: {
                        userId: session.user.id,
                        workdayStartTime: {
                            gte: dayStart,
                            lte: dayEnd,
                        },
                        workdayEndTime: null,
                    },
                    select: {
                        id: true,
                        locationRequired: true,
                    },
                })
            } catch (modelError) {
                // Workday model doesn't exist yet
                console.warn("Workday model not available:", modelError)
                return NextResponse.json(
                    { message: "Workday feature not available yet. Please run: npx prisma db push --accept-data-loss && npx prisma generate" },
                    { status: 503 }
                )
            }

            if (!activeWorkday) {
                return NextResponse.json({ message: "No active workday found" }, { status: 400 })
            }

            // Stop any running task timers
            // Stop any running task timers
            // Use updateMany to ensure all potentially active entries are closed (robustness)
            await prisma.timeEntry.updateMany({
                where: {
                    userId: session.user.id,
                    endTime: null,
                },
                data: {
                    endTime: new Date(),
                },
            })

            // Get location if required
            let endLocationLat: number | null = null
            let endLocationLng: number | null = null
            let endLocationVerified = false

            if (activeWorkday.locationRequired && location) {
                endLocationLat = location.latitude
                endLocationLng = location.longitude
                endLocationVerified = true
            }

            let updatedWorkday
            try {
                updatedWorkday = await prisma.workday.update({
                    where: { id: activeWorkday.id },
                    data: {
                        workdayEndTime: new Date(),
                        endLocationLat,
                        endLocationLng,
                        endLocationVerified,
                    },
                    select: {
                        id: true,
                        workdayStartTime: true,
                        workdayEndTime: true,
                    },
                })
            } catch (modelError) {
                // Workday model doesn't exist yet
                console.warn("Workday model not available:", modelError)
                return NextResponse.json(
                    { message: "Workday feature not available yet. Please run: npx prisma db push --accept-data-loss && npx prisma generate" },
                    { status: 503 }
                )
            }

            return NextResponse.json({ workday: updatedWorkday })
        }

        return NextResponse.json({ message: "Invalid action" }, { status: 400 })
    } catch (error) {
        console.error("Error managing workday:", error)
        // If model doesn't exist, return helpful error
        if (error instanceof Error && (error.message.includes('workday') || error.message.includes('Cannot read properties'))) {
            return NextResponse.json(
                { message: "Workday feature not available yet. Please run database migration: npx prisma db push --accept-data-loss && npx prisma generate" },
                { status: 503 }
            )
        }
        return NextResponse.json({ message: "Internal server error" }, { status: 500 })
    }
}

