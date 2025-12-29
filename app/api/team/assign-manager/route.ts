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
        const { employeeId, managerId, chiefType } = await req.json()

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

        // Prepare update data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = { managerId: managerId || null }

        // Logic for Chief Type (when removing manager from an ADMIN)
        if (!managerId && employee.role === "ADMIN" && chiefType) {
            // Handle chief type assignment
            let sharedChiefGroupId: string | null = null

            if (chiefType === "partner") {
                // Partner (Shared Chief) logic
                // Check if current user is also a top-level chief
                if (currentUser.managerId) {
                    return NextResponse.json({
                        message: "Only top-level chiefs can add partners. You must be a root-level chief."
                    }, { status: 400 })
                }

                // Get current user's sharedChiefGroupId
                const fullCurrentUser = await prisma.user.findUnique({
                    where: { id: currentUser.id },
                    select: { sharedChiefGroupId: true }
                })

                if (fullCurrentUser?.sharedChiefGroupId) {
                    sharedChiefGroupId = fullCurrentUser.sharedChiefGroupId
                } else {
                    // Create a new shared group ID
                    sharedChiefGroupId = `shared_${currentUser.id}_${Date.now()}`

                    // Also update current user to have this shared group ID
                    await prisma.user.update({
                        where: { id: currentUser.id },
                        data: { sharedChiefGroupId }
                    })
                }
            } else if (chiefType === "independent") {
                // Independent Chief - no shared group
                sharedChiefGroupId = null
            }

            // Add sharedChiefGroupId to update data
            updateData.sharedChiefGroupId = sharedChiefGroupId
        } else if (managerId) {
            // If assigning a manager, clear sharedChiefGroupId
            updateData.sharedChiefGroupId = null
        }

        // Update the assignment
        const updatedUser = await prisma.user.update({
            where: { id: employeeId },
            data: updateData,
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
