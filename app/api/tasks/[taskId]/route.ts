
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { getAllDescendants } from "@/lib/hierarchy-utils"
import { createNotification } from "@/lib/create-notification"

export async function GET(
    req: Request,
    { params }: { params: { taskId: string } }
) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    try {
        const task = await prisma.task.findUnique({
            where: { id: params.taskId },
            include: {
                assignees: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true
                    }
                }
            }
        })

        if (!task) return NextResponse.json({ message: "Task not found" }, { status: 404 })

        return NextResponse.json(task)
    } catch {
        return NextResponse.json({ message: "Error fetching task" }, { status: 500 })
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: { taskId: string } }
) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    try {
        const body = await req.json()
        const { title, description, status, isCompleted, priority, deadline, assignedToIds } = body

        // If status/isCompleted update logic needs to be preserved:
        let newStatus = status
        if (isCompleted !== undefined && !status) {
            newStatus = isCompleted ? "DONE" : "TODO"
        }

        // Get task to check permissions
        const taskToCheck = await prisma.task.findUnique({
            where: { id: params.taskId },
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
                const currentUser = await prisma.user.findUnique({
                    where: { id: session.user.id },
                    select: { id: true, projectId: true }
                })
                if (currentUser?.projectId) {
                    const allUsers = await prisma.user.findMany({
                        where: { projectId: currentUser.projectId },
                        select: { id: true, managerId: true }
                    })
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const descendants = new Set(getAllDescendants(currentUser.id, allUsers as any))
                    if (taskToCheck.assignees.some(u => descendants.has(u.id))) {
                        hasPermission = true
                    }
                }
            }
        }

        if (!hasPermission) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        // Prepare update data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {}
        if (title !== undefined) updateData.title = title
        if (description !== undefined) updateData.description = description
        if (newStatus !== undefined) updateData.status = newStatus
        if (isCompleted !== undefined) updateData.isCompleted = newStatus === "DONE"
        if (priority !== undefined) updateData.priority = priority
        if (deadline !== undefined) updateData.deadline = deadline ? new Date(deadline) : null

        // Handle assignee updates if provided
        let previousAssigneeIds: string[] = []
        if (assignedToIds) {
            // Get previous assignees before update
            previousAssigneeIds = taskToCheck.assignees.map(u => u.id)

            updateData.assignees = {
                set: [], // Clear existing
                connect: (assignedToIds as string[]).map(id => ({ id }))
            }
        }

        const task = await prisma.task.update({
            where: { id: params.taskId },
            data: updateData,
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

        // Create notifications for newly assigned users (excluding the creator)
        if (assignedToIds) {
            const newAssigneeIds = (assignedToIds as string[])
            const newlyAssigned = newAssigneeIds.filter(id =>
                !previousAssigneeIds.includes(id) && id !== session.user.id
            )

            if (newlyAssigned.length > 0) {
                await prisma.notification.createMany({
                    data: newlyAssigned.map(id => ({
                        userId: id,
                        title: "New Task Assigned",
                        message: `You have been assigned to task: "${task.title || title || 'Untitled Task'}"`,
                        link: '/tasks',
                        type: "INFO" as const
                    }))
                })
            }
        }

        return NextResponse.json(task)
    } catch (error) {
        console.error(error)
        return NextResponse.json({ message: "Error updating task" }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: { taskId: string } }
) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    // Admin can delete, Manager checks hierarchy
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const id = params.taskId

    if (session.user.role === "MANAGER") {
        const task = await prisma.task.findUnique({ where: { id }, include: { assignees: true } })
        if (!task) return NextResponse.json({ message: "Not found" }, { status: 404 })

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true, projectId: true }
        })
        const allUsers = await prisma.user.findMany({
            where: { projectId: currentUser?.projectId },
            select: { id: true, managerId: true }
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const descendants = new Set(getAllDescendants(currentUser!.id, allUsers as any))
        // Manager can delete if he manages ALL assignees (or if there are no assignees and it's his project logic? - stick to strict for now)
        // If task has no assignees, we might want to check project? But for now stick to assignee check.
        const isManagerOfAll = task.assignees.length > 0 && task.assignees.every(u => descendants.has(u.id) || u.id === currentUser!.id)

        // Allow deleting tasks with no assignees if created by? OR just restrict.
        // Let's stick to the code from previous route for consistency:
        // "const isManagerOfAll = task.assignees.every(u => descendants.has(u.id) || u.id === currentUser!.id)"
        // Note: empty array.every returns true. So if no assignees, manager can delete. That seems acceptable.

        if (!isManagerOfAll) return NextResponse.json({ message: "Forbidden: Task involves users outside your management" }, { status: 403 })
    }

    try {
        await prisma.task.delete({ where: { id } })
        return NextResponse.json({ message: "Deleted" })
    } catch {
        return NextResponse.json({ message: "Error deleting task" }, { status: 500 })
    }
}
