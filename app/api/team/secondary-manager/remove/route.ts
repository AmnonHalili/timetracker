import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageUser } from "@/lib/hierarchy-utils"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const { employeeId, managerId } = await req.json()

        if (!employeeId || !managerId) {
            return NextResponse.json({ message: "employeeId and managerId are required" }, { status: 400 })
        }

        // Fetch current user
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id }
        })

        if (!currentUser) {
            return NextResponse.json({ message: "User not found" }, { status: 404 })
        }

        // Fetch employee
        const employee = await prisma.user.findUnique({
            where: { id: employeeId }
        })

        if (!employee) {
            return NextResponse.json({ message: "Employee not found" }, { status: 404 })
        }

        // Check if current user can manage this employee
        const allUsers = await prisma.user.findMany({
            where: { projectId: currentUser.projectId }
        })

        if (!canManageUser(currentUser, employee, allUsers)) {
            return NextResponse.json({ message: "Forbidden: You don't have permission to manage this user" }, { status: 403 })
        }

        // Find the secondary manager relationship
        const relationship = await prisma.secondaryManager.findUnique({
            where: {
                employeeId_managerId: {
                    employeeId,
                    managerId
                }
            }
        })

        if (!relationship) {
            return NextResponse.json({ message: "Secondary manager relationship not found" }, { status: 404 })
        }

        // Delete the relationship
        await prisma.secondaryManager.delete({
            where: { id: relationship.id }
        })

        return NextResponse.json({ message: "Secondary manager removed successfully" })
    } catch (error) {
        console.error("[REMOVE_SECONDARY_MANAGER_ERROR]", error)
        return NextResponse.json({ message: "Failed to remove secondary manager" }, { status: 500 })
    }
}
