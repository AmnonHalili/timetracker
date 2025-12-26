import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageUser } from "@/lib/hierarchy-utils"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const { employeeId, managerId, permissions } = await req.json()

        if (!employeeId || !managerId) {
            return NextResponse.json({ message: "employeeId and managerId are required" }, { status: 400 })
        }

        if (!Array.isArray(permissions) || permissions.length === 0) {
            return NextResponse.json({ message: "permissions must be a non-empty array" }, { status: 400 })
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

        // Fetch manager to validate
        const manager = await prisma.user.findUnique({
            where: { id: managerId }
        })

        if (!manager) {
            return NextResponse.json({ message: "Manager not found" }, { status: 404 })
        }

        // Ensure manager is in same project
        if (manager.projectId !== employee.projectId) {
            return NextResponse.json({ message: "Manager must be in the same project" }, { status: 400 })
        }

        // Prevent assigning employee as secondary manager to themselves
        if (employeeId === managerId) {
            return NextResponse.json({ message: "Cannot assign user as their own secondary manager" }, { status: 400 })
        }

        // Check if relationship already exists
        const existing = await prisma.secondaryManager.findUnique({
            where: {
                employeeId_managerId: {
                    employeeId,
                    managerId
                }
            }
        })

        if (existing) {
            // Update permissions if exists
            const updated = await prisma.secondaryManager.update({
                where: { id: existing.id },
                data: { permissions },
                include: {
                    manager: {
                        select: { id: true, name: true, email: true, image: true }
                    }
                }
            })
            return NextResponse.json({ secondaryManager: updated, message: "Secondary manager permissions updated" })
        }

        // Create new secondary manager relationship
        const secondaryManager = await prisma.secondaryManager.create({
            data: {
                employeeId,
                managerId,
                permissions
            },
            include: {
                manager: {
                    select: { id: true, name: true, email: true, image: true }
                }
            }
        })

        return NextResponse.json({ secondaryManager, message: "Secondary manager added successfully" })
    } catch (error) {
        console.error("[ADD_SECONDARY_MANAGER_ERROR]", error)
        return NextResponse.json({ message: "Failed to add secondary manager" }, { status: 500 })
    }
}
