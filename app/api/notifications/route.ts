import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    const notifications = await prisma.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 20
    })

    return NextResponse.json(notifications)
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
