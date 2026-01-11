import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { createNotification } from "@/lib/create-notification"
import { NotificationType } from "@prisma/client"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    const notifications = await prisma.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 20
    })

    // Add cache headers to prevent stale data
    return NextResponse.json(notifications, {
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    })
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    try {
        const { userId, title, message, link, type } = await req.json()

        if (!userId || !title || !message) {
            return NextResponse.json(
                { message: "Missing required fields" },
                { status: 400 }
            )
        }

        const notification = await createNotification({
            userId,
            title,
            message,
            link,
            type: type as NotificationType | undefined,
        })

        return NextResponse.json(notification, { status: 201 })
    } catch (error) {
        console.error("Error creating notification:", error)
        return NextResponse.json(
            { message: "Error creating notification" },
            { status: 500 }
        )
    }
}

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    try {
        const { id, markAllRead } = await req.json()

        if (markAllRead) {
            await prisma.notification.updateMany({
                where: { userId: session.user.id, isRead: false },
                data: { isRead: true }
            })
            return NextResponse.json({ message: "All marked as read" })
        }

        if (id) {
            await prisma.notification.update({
                where: { id },
                data: { isRead: true }
            })
            return NextResponse.json({ message: "Marked as read" })
        }

        return NextResponse.json({ message: "No action" })
    } catch {
        return NextResponse.json({ message: "Error updating notification" }, { status: 500 })
    }
}
