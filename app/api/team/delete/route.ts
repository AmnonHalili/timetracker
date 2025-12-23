import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Verify admin or manager role
    const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, projectId: true }
    })

    if (!currentUser || !["ADMIN", "MANAGER"].includes(currentUser.role)) {
        return NextResponse.json({ message: "Forbidden: Admin or Manager access required" }, { status: 403 })
    }

    try {
        const { userId } = await req.json()

        if (!userId) {
            return NextResponse.json({ message: "User ID is required" }, { status: 400 })
        }

        // Verify the user belongs to the same project
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { projectId: true, role: true }
        })

        if (targetUser?.projectId !== currentUser.projectId) {
            return NextResponse.json({ message: "Forbidden: User not in your project" }, { status: 403 })
        }

        // Prevent deleting the last admin
        if (targetUser?.role === "ADMIN") {
            const adminCount = await prisma.user.count({
                where: {
                    projectId: currentUser.projectId,
                    role: "ADMIN"
                }
            })

            if (adminCount <= 1) {
                return NextResponse.json({
                    message: "Cannot delete: This is the only admin in the project. At least one admin must exist."
                }, { status: 400 })
            }
        }

        // Delete the user (cascade will delete related data)
        await prisma.user.delete({
            where: { id: userId }
        })

        return NextResponse.json({ message: "User deleted successfully" })
    } catch (error) {
        console.error("[TEAM_USER_DELETE_ERROR]", error)
        return NextResponse.json({ message: "Failed to delete user" }, { status: 500 })
    }
}
