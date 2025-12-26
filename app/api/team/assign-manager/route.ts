import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { detectCircularReference, canManageUser } from "@/lib/hierarchy-utils"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id }
    })

    if (!currentUser?.projectId) {
        return NextResponse.json({ message: "No project found" }, { status: 404 })
    }

    try {
        const { employeeId, managerId } = await req.json()

        if (!employeeId) {
            return NextResponse.json({ message: "Employee ID is required" }, { status: 400 })
        }

        // Fetch employee user
        const employee = await prisma.user.findUnique({
            where: { id: employeeId }
        })

        if (!employee) {
            return NextResponse.json({ message: "Employee not found" }, { status: 404 })
        }

        if (employee.projectId !== currentUser.projectId) {
            return NextResponse.json({ message: "Employee not in your project" }, { status: 403 })
        }

        // Permission check using canManageUser
        const allUsers = await prisma.user.findMany({
            where: { projectId: currentUser.projectId }
        })

        if (!canManageUser(currentUser, employee, allUsers)) {
            return NextResponse.json({ message: "Forbidden: You don't have permission to manage this user" }, { status: 403 })
        }

        // Validate assignment if managerId is provided
        if (managerId) {
            const manager = await prisma.user.findUnique({
                where: { id: managerId },
                select: { projectId: true, role: true }
            })

            if (!manager) {
                return NextResponse.json({ message: "Manager not found" }, { status: 404 })
            }

            if (manager.projectId !== currentUser.projectId) {
                return NextResponse.json({ message: "Manager not in your project" }, { status: 403 })
            }

            // Validate role constraints
            if (employee.role === "ADMIN") {
                return NextResponse.json({ message: "Cannot assign manager to ADMIN role" }, { status: 400 })
            }

            if (manager.role === "EMPLOYEE") {
                return NextResponse.json({ message: "EMPLOYEE cannot be a manager" }, { status: 400 })
            }

            // Check for circular references (reuse allUsers from above)
            if (detectCircularReference(employeeId, managerId, allUsers)) {
                return NextResponse.json({ message: "This assignment would create a circular reference" }, { status: 400 })
            }
        }

        // Update the assignment
        const updatedUser = await prisma.user.update({
            where: { id: employeeId },
            data: { managerId: managerId || null },
            select: { id: true, name: true, managerId: true }
        })

        return NextResponse.json({
            user: updatedUser,
            message: managerId ? "Manager assigned successfully" : "Manager unassigned successfully"
        })
    } catch (error) {
        console.error("[ASSIGN_MANAGER_ERROR]", error)
        return NextResponse.json({ message: "Failed to assign manager" }, { status: 500 })
    }
}

