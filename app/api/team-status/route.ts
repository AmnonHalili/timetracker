import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { TimeEntry, TimeBreak } from "@prisma/client"

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true, projectId: true }
    })

    if (!user) {
        return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    // Only admins can see team status
    if (user.role !== "ADMIN" || !user.projectId) {
        return NextResponse.json([])
    }

    const projectUsers = await prisma.user.findMany({
        where: {
            projectId: user.projectId,
            status: "ACTIVE",
            NOT: { id: user.id }
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            jobTitle: true,
            timeEntries: {
                where: { endTime: null },
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
                    breaks: {
                        where: { endTime: null },
                        select: {
                            id: true,
                            timeEntryId: true,
                            startTime: true,
                            endTime: true,
                            reason: true,
                            locationLat: true,
                            locationLng: true
                        }
                    }
                }
            },
            lastSeen: true
        }
    })

    type ProjectUser = {
        id: string
        name: string
        email: string
        role: "ADMIN" | "EMPLOYEE" | "MANAGER"
        jobTitle: string | null
        lastSeen: Date | null
        timeEntries: (TimeEntry & { breaks: TimeBreak[] })[]
    }

    const teamStatus = (projectUsers as unknown as ProjectUser[]).map((u) => {
        const activeEntry = u.timeEntries[0]
        let status: 'WORKING' | 'BREAK' | 'OFFLINE' | 'ONLINE' = 'OFFLINE'
        let lastActive: Date | undefined = undefined

        // Check for active time entry first
        if (activeEntry) {
            const activeBreak = activeEntry.breaks && activeEntry.breaks.length > 0
            status = activeBreak ? 'BREAK' : 'WORKING'
            lastActive = activeEntry.startTime
        }
        // If not working, check for online presence (lastSeen within 90 seconds)
        else if (u.lastSeen) {
            const ninetySecondsAgo = new Date(Date.now() - 90000)
            if (u.lastSeen > ninetySecondsAgo) {
                status = 'ONLINE'
                lastActive = u.lastSeen
            }
        }

        return {
            userId: u.id,
            name: u.name,
            email: u.email,
            role: u.role as "ADMIN" | "EMPLOYEE",
            jobTitle: u.jobTitle,
            status,
            lastActive
        }
    })

    return NextResponse.json(teamStatus)
}

