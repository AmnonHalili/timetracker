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
                include: { breaks: { where: { endTime: null } } }
            }
        }
    })

    type ProjectUser = {
        id: string
        name: string
        email: string
        role: "ADMIN" | "EMPLOYEE" | "MANAGER"
        jobTitle: string | null
        timeEntries: (TimeEntry & { breaks: TimeBreak[] })[]
    }

    const teamStatus = (projectUsers as unknown as ProjectUser[]).map((u) => {
        const activeEntry = u.timeEntries[0]
        let status: 'WORKING' | 'BREAK' | 'OFFLINE' = 'OFFLINE'
        let lastActive: Date | undefined = undefined

        if (activeEntry) {
            const activeBreak = activeEntry.breaks && activeEntry.breaks.length > 0
            status = activeBreak ? 'BREAK' : 'WORKING'
            lastActive = activeEntry.startTime
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

