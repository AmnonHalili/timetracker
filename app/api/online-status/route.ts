import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// In-memory store for online users
// Key: userId, Value: last seen timestamp
const onlineUsers = new Map<string, number>()

// Cleanup interval - remove users who haven't pinged in 90 seconds
const ONLINE_THRESHOLD = 90000 // 90 seconds
const CLEANUP_INTERVAL = 30000 // 30 seconds

// Periodic cleanup
if (typeof window === 'undefined') {
    setInterval(() => {
        const now = Date.now()
        Array.from(onlineUsers.entries()).forEach(([userId, lastSeen]) => {
            if (now - lastSeen > ONLINE_THRESHOLD) {
                onlineUsers.delete(userId)
            }
        })
    }, CLEANUP_INTERVAL)
}

// POST - Send heartbeat
export async function POST() {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Update last seen timestamp
        onlineUsers.set(session.user.id, Date.now())

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error updating online status:", error)
        return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}

// GET - Retrieve online users
export async function GET() {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Clean up stale entries before returning
        const now = Date.now()
        const onlineUserIds: string[] = []

        Array.from(onlineUsers.entries()).forEach(([userId, lastSeen]) => {
            if (now - lastSeen <= ONLINE_THRESHOLD) {
                onlineUserIds.push(userId)
            } else {
                onlineUsers.delete(userId)
            }
        })

        return NextResponse.json({ onlineUsers: onlineUserIds })
    } catch (error) {
        console.error("Error fetching online status:", error)
        return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
}
