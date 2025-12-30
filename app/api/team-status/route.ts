import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"


export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // 1. Fetch current user to get their hierarchy info
    const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            projectId: true,
            managerId: true
        }
    })

    if (!currentUser) {
        return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    if (!currentUser.projectId) {
        return NextResponse.json([])
    }

    // Common selection for status display
    const userSelect = {
        id: true,
        name: true,
        email: true,
        role: true,
        jobTitle: true,
        lastSeen: true,
        timeEntries: {
            where: { endTime: null },
            select: {
                id: true,
                startTime: true,
                breaks: {
                    where: { endTime: null },
                    select: { id: true }
                }
            }
        }
    }

    // 2. Parallel fetch for Manager, Reports, and Peers
    const [manager, directReports, peers] = await Promise.all([
        // Fetch Manager
        currentUser.managerId ? prisma.user.findUnique({
            where: { id: currentUser.managerId },
            select: userSelect
        }) : Promise.resolve(null),

        // Fetch Direct Reports (Children)
        prisma.user.findMany({
            where: {
                managerId: currentUser.id,
                status: "ACTIVE"
            },
            select: userSelect
        }),

        // Fetch Peers (Same Manager) - Only if user has a manager
        currentUser.managerId ? prisma.user.findMany({
            where: {
                managerId: currentUser.managerId,
                status: "ACTIVE",
                NOT: { id: currentUser.id } // Exclude self
            },
            select: userSelect
        }) : Promise.resolve([])
    ])

    // 3. Combine results in specific order: Manager -> Reports -> Peers
    const rawUsers = [
        ...(manager ? [manager] : []),
        ...directReports,
        ...peers
    ]

    // 4. Transform to TeamMemberStatus format
    // Define exact type for the query result to avoid 'any'
    type QueryUser = {
        id: string
        name: string
        email: string
        role: string // Prisma Role enum, simplified as string here
        jobTitle: string | null
        lastSeen: Date | null
        timeEntries: {
            id: string
            startTime: Date
            breaks: { id: string }[]
        }[]
    }

    const teamStatus = (rawUsers as QueryUser[]).map((u) => {
        const activeEntry = u.timeEntries[0]
        let status: 'WORKING' | 'BREAK' | 'OFFLINE' | 'ONLINE' = 'OFFLINE'
        let lastActive: Date | undefined = undefined

        if (activeEntry) {
            const activeBreak = activeEntry.breaks.length > 0
            status = activeBreak ? 'BREAK' : 'WORKING'
            lastActive = activeEntry.startTime
        } else if (u.lastSeen) {
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

