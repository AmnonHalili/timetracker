import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Verify admin role
    const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, projectId: true }
    })

    if (currentUser?.role !== "ADMIN") {
        return NextResponse.json({ message: "Forbidden: Admin access required" }, { status: 403 })
    }

    try {
        const { userId, dailyTarget, workDays } = await req.json()

        if (!userId) {
            return NextResponse.json({ message: "User ID is required" }, { status: 400 })
        }

        if (typeof dailyTarget !== 'number' || dailyTarget < 0) {
            return NextResponse.json({ message: "Invalid daily target" }, { status: 400 })
        }

        if (!Array.isArray(workDays) || !workDays.every((d: unknown) => typeof d === 'number' && d >= 0 && d <= 6)) {
            return NextResponse.json({ message: "Invalid work days" }, { status: 400 })
        }

        // Verify the user belongs to the same project
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { projectId: true }
        })

        if (targetUser?.projectId !== currentUser.projectId) {
            return NextResponse.json({ message: "Forbidden: User not in your project" }, { status: 403 })
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                dailyTarget,
                workDays
            },
            select: { id: true, dailyTarget: true, workDays: true }
        })

        return NextResponse.json({ user: updatedUser, message: "Work settings updated successfully" })
    } catch (error) {
        console.error("[TEAM_WORK_SETTINGS_UPDATE_ERROR]", error)
        return NextResponse.json({ message: "Failed to update work settings" }, { status: 500 })
    }
}
