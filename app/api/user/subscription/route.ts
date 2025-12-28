import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        // For now, check if user's project has more than 5 users
        // If yes, they're on a paid plan, otherwise free
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { projectId: true }
        })

        if (!user) {
            return NextResponse.json({ isFree: true })
        }

        if (!user.projectId) {
            // Private workspace - free
            return NextResponse.json({ isFree: true })
        }

        // Count users in project
        const userCount = await prisma.user.count({
            where: { projectId: user.projectId, status: "ACTIVE" }
        })

        // Free plan: up to 5 users
        // Paid plans: 6+ users
        const isFree = userCount <= 5

        console.log(`[SUBSCRIPTION_CHECK] User ${session.user.id}, Project ${user.projectId}, User count: ${userCount}, IsFree: ${isFree}`)

        return NextResponse.json({ isFree, userCount })
    } catch (error) {
        console.error("[SUBSCRIPTION_CHECK_ERROR]", error)
        // Default to free on error
        return NextResponse.json({ isFree: true })
    }
}

