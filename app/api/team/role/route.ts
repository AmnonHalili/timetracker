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
        const { userId, role } = await req.json()

        if (!userId) {
            return NextResponse.json({ message: "User ID is required" }, { status: 400 })
        }

        if (!["ADMIN", "MANAGER", "EMPLOYEE"].includes(role)) {
            return NextResponse.json({ message: "Invalid role" }, { status: 400 })
        }

        // Verify the user belongs to the same project
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { projectId: true }
        })

        if (targetUser?.projectId !== currentUser.projectId) {
            return NextResponse.json({ message: "Forbidden: User not in your project" }, { status: 403 })
        }

        // Prevent changing role if this is the last admin
        if (targetUser) {
            const userToUpdate = await prisma.user.findUnique({
                where: { id: userId },
                select: { role: true }
            })

            if (userToUpdate?.role === "ADMIN" && role !== "ADMIN") {
                // Count admins in the project
                const adminCount = await prisma.user.count({
                    where: {
                        projectId: currentUser.projectId,
                        role: "ADMIN"
                    }
                })

                if (adminCount <= 1) {
                    return NextResponse.json({
                        message: "Cannot change role: This is the only admin in the project. At least one admin must exist."
                    }, { status: 400 })
                }
            }
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { role },
            select: { id: true, role: true }
        })

        return NextResponse.json({ user: updatedUser, message: "Role updated successfully" })
    } catch (error) {
        console.error("[TEAM_ROLE_UPDATE_ERROR]", error)
        return NextResponse.json({ message: "Failed to update role" }, { status: 500 })
    }
}
