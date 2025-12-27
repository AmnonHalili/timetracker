import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const { userId, managerId } = await req.json()

        if (!userId) {
            return NextResponse.json({ message: "User ID is required" }, { status: 400 })
        }

        // Get current user and target user
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true, role: true, projectId: true }
        })

        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, managerId: true, projectId: true }
        })

        if (!currentUser || !targetUser) {
            return NextResponse.json({ message: "User not found" }, { status: 404 })
        }

        // Permission check
        if (currentUser.role === 'EMPLOYEE') {
            return NextResponse.json({ message: "Employees cannot edit manager assignments" }, { status: 403 })
        }

        // Admin can edit anyone in their project
        if (currentUser.role === 'ADMIN') {
            if (currentUser.projectId !== targetUser.projectId) {
                return NextResponse.json({ message: "Cannot edit users from different projects" }, { status: 403 })
            }
        } else {
            // Manager needs to be above in hierarchy
            const isManager = targetUser.managerId === currentUser.id

            // Or check if in management chain
            const isInChain = async (checkUserId: string, managerId: string): Promise<boolean> => {
                const user = await prisma.user.findUnique({
                    where: { id: checkUserId },
                    select: { managerId: true }
                })

                if (!user || !user.managerId) return false
                if (user.managerId === managerId) return true
                return isInChain(user.managerId, managerId)
            }

            const hasPermission = isManager || await isInChain(userId, currentUser.id)

            if (!hasPermission) {
                return NextResponse.json({ message: "You don't have permission to edit this user's manager" }, { status: 403 })
            }
        }

        // Update the manager
        await prisma.user.update({
            where: { id: userId },
            data: { managerId: managerId || null }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error updating manager:", error)
        return NextResponse.json({ message: "Internal server error" }, { status: 500 })
    }
}
