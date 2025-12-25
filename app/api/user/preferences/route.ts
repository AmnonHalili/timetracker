import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        // Fetch current user details for permission check
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, projectId: true }
        })

        if (!currentUser) return NextResponse.json({ message: "User not found" }, { status: 404 })

        // Employees in a project cannot update their own work settings
        if (currentUser.role === 'EMPLOYEE' && currentUser.projectId) {
            return NextResponse.json({ message: "Permission denied. Contact your admin." }, { status: 403 })
        }

        const { dailyTarget, workDays } = await req.json()

        if (dailyTarget !== null && (typeof dailyTarget !== 'number' || dailyTarget < 0)) {
            return NextResponse.json({ message: "Invalid daily target" }, { status: 400 })
        }

        if (workDays && (!Array.isArray(workDays) || !workDays.every((d: unknown) => typeof d === 'number' && d >= 0 && d <= 6))) {
            return NextResponse.json({ message: "Invalid work days" }, { status: 400 })
        }

        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                dailyTarget,
                ...(workDays && { workDays }),
            },
            select: { id: true, dailyTarget: true, workDays: true }
        })

        return NextResponse.json({ user: updatedUser, message: "Preferences updated successfully" })
    } catch (error) {
        console.error("[PREFERENCES_UPDATE_ERROR]", error)
        return NextResponse.json({ message: "Failed to update preferences" }, { status: 500 })
    }
}
