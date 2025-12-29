import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

// Cleanup interval - remove users who haven't pinged in 90 seconds (Database query handles this filter)
const ONLINE_THRESHOLD = 90000 // 90 seconds

// POST - Send heartbeat
export async function POST() {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Update last seen timestamp in DB
        await prisma.user.update({
            where: { id: session.user.id },
            data: { lastSeen: new Date() }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error updating online status:", error)
        return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}

// GET - Retrieve active users
export async function GET() {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Get current user's project
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { projectId: true, email: true }
        })

        if (!currentUser?.projectId) {
            console.log(`[OnlineStatus] User ${currentUser?.email} has no project.`)
            return NextResponse.json({ onlineUsers: [session.user.id] })
        }

        // Calculate threshold for active users
        const threshold = new Date(Date.now() - ONLINE_THRESHOLD)

        // Fetch users active since threshold AND in the same project
        const activeUsers = await prisma.user.findMany({
            where: {
                projectId: currentUser.projectId,
                lastSeen: {
                    gt: threshold
                }
            },
            select: {
                id: true,
                email: true,
                lastSeen: true
            }
        })

        const onlineUserIds = activeUsers.map(user => user.id)

        return NextResponse.json({ onlineUsers: onlineUserIds })
    } catch (error) {
        console.error("Error fetching online status:", error)
        return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}
