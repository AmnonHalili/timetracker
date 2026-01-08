import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

// GET tasks is handled in the page server component usually, but if we need client fetch:
export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    // ... filtering logic if needed
    return NextResponse.json({ message: "Use Server Actions or Page Data" })
}

import { getAllDescendants } from "@/lib/hierarchy-utils"

// ... imports remain the same

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    // Allow all users to create tasks (but restricted assignment)
    // if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    //     return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    // }

    try {
        const body = await req.json()
        const { title, assignedToIds, priority, startDate, deadline, description, subtasks } = body

        // Validate permissions  
        // ADMIN: Can assign to anyone in project
        // MANAGER: Can assign to descendants
        // SECONDARY MANAGER with MANAGE_TASKS: Can assign to managed employees
        // EMPLOYEE: Can only assign to self

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true, projectId: true, role: true }
        })

        if (!currentUser) {
            return NextResponse.json({ message: "User not found" }, { status: 404 })
        }

        const targetIds = new Set(assignedToIds as string[])

        if (currentUser.role !== "ADMIN") {
            const allUsers = await prisma.user.findMany({
                where: { projectId: currentUser.projectId },
                select: { id: true, managerId: true }
            })

            // Fetch secondary manager relationships
            const secondaryRelations = await prisma.secondaryManager.findMany({
                where: { managerId: currentUser.id },
                select: { employeeId: true, managerId: true, permissions: true }
            })

            if (currentUser.role === "MANAGER") {
                // Primary manager check + secondary manager check
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const descendants = getAllDescendants(currentUser.id, allUsers as any)
                const secondaryEmployees = secondaryRelations
                    .filter(rel => rel.permissions.includes('MANAGE_TASKS'))
                    .map(rel => rel.employeeId)

                const allowedIds = new Set([currentUser.id, ...descendants, ...secondaryEmployees])

                if (!Array.from(targetIds).every(id => allowedIds.has(id))) {
                    return NextResponse.json({ message: "Cannot assign tasks to users outside your hierarchy or managed employees" }, { status: 403 })
                }
            } else {
                // Regular user or Private Workspace: Can only assign to self
                if (!Array.from(targetIds).every(id => id === session.user.id)) {
                    return NextResponse.json({ message: "You can only assign tasks to yourself" }, { status: 403 })
                }
            }
        }

        const task = await prisma.task.create({
            data: {
                title,
                projectId: currentUser.projectId,
                assignees: {
                    connect: (assignedToIds as string[]).map(id => ({ id }))
                },
                priority: priority || "NONE",
                startDate: startDate ? new Date(startDate) : null,
                deadline: deadline ? new Date(deadline) : null,
                description,
                status: "TODO",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                subtasks: subtasks && Array.isArray(subtasks) && subtasks.length > 0 ? {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    create: subtasks.map((st: any) => ({
                        title: st.title,
                        priority: st.priority || "NONE",
                        assignedToId: st.assignedToId || null,
                        startDate: st.startDate ? new Date(st.startDate) : null,
                        dueDate: st.dueDate ? new Date(st.dueDate) : null
                    }))
                } : undefined
            },
            include: {
                assignees: true,
                subtasks: {
                    include: {
                        assignedTo: {
                            select: { id: true, name: true, image: true }
                        }
                    }
                }
            }
        })

        // ... notification logic (kept simple or improved)
        // Only create notifications for users other than the creator
        // If user assigns task to themselves, no notification
        // If user assigns task to others, they get notifications
        const notificationsData = (assignedToIds as string[])
            .filter(id => id !== session.user.id) // Exclude the creator
            .map(id => ({
                userId: id,
                title: "New Task Assigned",
                message: `You have been assigned to task: "${title}"`,
                link: '/tasks',
                type: "INFO" as const
            }))

        if (notificationsData.length > 0) {
            await prisma.notification.createMany({
                data: notificationsData
            })
        }

        return NextResponse.json(task)
    } catch {
        return NextResponse.json({ message: "Error creating task" }, { status: 500 })
    }
}

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    try {
        const { id, status, isCompleted, priority, deadline, action } = await req.json()

        // Handle archive/unarchive action
        if (action === 'archive' || action === 'unarchive') {
            // Get task to check permissions
            const taskToCheck = await prisma.task.findUnique({
                where: { id },
                include: { assignees: { select: { id: true } } }
            })

            if (!taskToCheck) return NextResponse.json({ message: "Task not found" }, { status: 404 })

            // Permission check (same as update)
            let hasPermission = false
            if (session.user.role === "ADMIN") {
                hasPermission = true
            } else {
                if (taskToCheck.assignees.some(u => u.id === session.user.id)) {
                    hasPermission = true
                }
                if (!hasPermission && session.user.role === "MANAGER") {
                    const currentUser = await prisma.user.findUnique({
                        where: { id: session.user.id },
                        select: { id: true, projectId: true }
                    })
                    if (currentUser?.projectId) {
                        const allUsers = await prisma.user.findMany({
                            where: { projectId: currentUser.projectId },
                            select: { id: true, managerId: true }
                        })
                        const descendants = new Set(getAllDescendants(currentUser.id, allUsers))
                        if (taskToCheck.assignees.some(u => descendants.has(u.id))) {
                            hasPermission = true
                        }
                    }
                }
            }

            if (!hasPermission) {
                return NextResponse.json({ message: "Forbidden" }, { status: 403 })
            }

            const task = await prisma.task.update({
                where: { id },
                data: {
                    isArchived: action === 'archive',
                    archivedAt: action === 'archive' ? new Date() : null
                },
                include: {
                    assignees: {
                        select: {
                            id: true,
                            name: true,
                            image: true
                        }
                    }
                }
            })

            return NextResponse.json(task)
        }

        // Regular update logic
        let newStatus = status
        if (isCompleted !== undefined && !status) {
            newStatus = isCompleted ? "DONE" : "TODO"
        }

        // Get task to check permissions
        const taskToCheck = await prisma.task.findUnique({
            where: { id },
            include: { assignees: { select: { id: true } } }
        })

        if (!taskToCheck) return NextResponse.json({ message: "Task not found" }, { status: 404 })

        // Permission check
        let hasPermission = false
        if (session.user.role === "ADMIN") {
            hasPermission = true
        } else {
            // Check if user is an assignee
            if (taskToCheck.assignees.some(u => u.id === session.user.id)) {
                hasPermission = true
            }
            // Check if user is a manager of any assignee
            if (!hasPermission && session.user.role === "MANAGER") {
                // Fetch hierarchy data
                const currentUser = await prisma.user.findUnique({
                    where: { id: session.user.id },
                    select: { id: true, projectId: true }
                })
                if (currentUser?.projectId) {
                    const allUsers = await prisma.user.findMany({
                        where: { projectId: currentUser.projectId },
                        select: { id: true, managerId: true }
                    })
                    const descendants = new Set(getAllDescendants(currentUser.id, allUsers))
                    if (taskToCheck.assignees.some(u => descendants.has(u.id))) {
                        hasPermission = true
                    }
                }
            }
        }

        if (!hasPermission) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const task = await prisma.task.update({
            where: { id },
            data: {
                status: newStatus,
                isCompleted: newStatus === "DONE",
                priority,
                deadline: deadline ? new Date(deadline) : undefined
            },
            include: {
                assignees: {
                    select: {
                        id: true,
                        name: true,
                        image: true
                    }
                }
            }
        })

        return NextResponse.json(task)
    } catch (error) {
        console.error("Error updating task:", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        return NextResponse.json({ 
            message: "Error updating task",
            error: errorMessage
        }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) return NextResponse.json({ message: "Missing ID" }, { status: 400 })

    // Check if user is an assignee
    const task = await prisma.task.findUnique({ where: { id }, include: { assignees: true } })
    if (!task) return NextResponse.json({ message: "Not found" }, { status: 404 })

    let hasPermission = false
    if (session.user.role === "ADMIN") {
        hasPermission = true
    } else if (task.assignees.some(u => u.id === session.user.id)) {
        // Allow assignees to delete their tasks
        hasPermission = true
    } else if (session.user.role === "MANAGER") {
        // Manager checks (existing logic)
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true, projectId: true }
        })
        const allUsers = await prisma.user.findMany({
            where: { projectId: currentUser?.projectId },
            select: { id: true, managerId: true }
        })

        const descendants = new Set(getAllDescendants(currentUser!.id, allUsers))
        // Manager can delete if they manage ALL assignees (or if task has no assignees but is in their project scope?)
        // For now trusting the existing strict check idea:
        const isManagerOfAll = task.assignees.every(u => descendants.has(u.id) || u.id === currentUser!.id)
        if (isManagerOfAll) hasPermission = true
    }

    if (!hasPermission) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    await prisma.task.delete({ where: { id } })
    return NextResponse.json({ message: "Deleted" })
}
