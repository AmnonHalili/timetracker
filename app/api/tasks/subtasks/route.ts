import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaAny = prisma as any;

// POST: Create a subtask item
export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    try {
        const { taskId, title, priority, assignedToId, dueDate } = await req.json()

        if (!taskId || !title) {
            return NextResponse.json({ message: "Task ID and title are required" }, { status: 400 })
        }

        // Verify task exists and user has permission
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { assignees: { select: { id: true } } }
        })

        // Validate assignedToId if provided - must be one of task assignees
        if (assignedToId) {
            const isValidAssignee = task?.assignees.some(a => a.id === assignedToId)
            if (!isValidAssignee) {
                return NextResponse.json({ message: "Assigned user must be one of the parent task's assignees" }, { status: 400 })
            }
        }

        if (!task) {
            return NextResponse.json({ message: "Task not found" }, { status: 404 })
        }

        // Permission check: user must be assignee of task or admin
        let hasPermission = false
        if (session.user.role === "ADMIN") {
            hasPermission = true
        } else if (task.assignees.some(u => u.id === session.user.id)) {
            hasPermission = true
        }

        if (!hasPermission) {
            return NextResponse.json({ message: "You don't have permission to add subtasks to this task" }, { status: 403 })
        }

        // Create subtask item
        let subtask
        try {
            // Check if subTaskItem exists in Prisma client
            if (!('subTaskItem' in prisma) || !prisma.subTaskItem) {
                return NextResponse.json({
                    message: "SubTaskItem model not available. Please stop your dev server, run: npx prisma db push && npx prisma generate, then restart the server."
                }, { status: 500 })
            }

            subtask = await prismaAny.subTaskItem.create({
                data: {
                    taskId,
                    title,
                    priority: priority || null,
                    assignedToId: assignedToId || null,
                    dueDate: dueDate ? new Date(dueDate) : null
                },
                include: {
                    assignedTo: {
                        select: { id: true, name: true, image: true }
                    }
                }
            })
        } catch (e: unknown) {
            // If SubTaskItem model doesn't exist yet, return error with helpful message
            const errorMessage = e instanceof Error ? e.message : String(e)
            if (errorMessage.includes('SubTaskItem') || errorMessage.includes('Unknown model') || errorMessage.includes('Cannot read properties')) {
                return NextResponse.json({
                    message: "SubTaskItem model not available. Please stop your dev server, run: npx prisma db push && npx prisma generate, then restart the server."
                }, { status: 500 })
            }
            throw e
        }

        return NextResponse.json(subtask)
    } catch (error) {
        console.error("[CREATE_SUBTASK_ERROR]", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        return NextResponse.json({
            message: "Error creating subtask",
            error: errorMessage
        }, { status: 500 })
    }
}

// PATCH: Update subtask (mark as done, etc.)
export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    try {
        const { id, title, isDone, priority, assignedToId, dueDate } = await req.json()

        if (!id) {
            return NextResponse.json({ message: "Subtask ID is required" }, { status: 400 })
        }

        // Verify subtask exists and get task for permission check
        if (!('subTaskItem' in prisma) || !prisma.subTaskItem) {
            return NextResponse.json({
                message: "SubTaskItem model not available. Please stop your dev server, run: npx prisma db push && npx prisma generate, then restart the server."
            }, { status: 500 })
        }

        let subtask
        try {
            subtask = await prismaAny.subTaskItem.findUnique({
                where: { id },
                include: {
                    task: {
                        include: { assignees: { select: { id: true } } }
                    }
                }
            })
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : String(e)
            if (errorMessage.includes('SubTaskItem') || errorMessage.includes('Unknown model') || errorMessage.includes('Cannot read properties')) {
                return NextResponse.json({
                    message: "SubTaskItem model not available. Please run: npx prisma db push && npx prisma generate"
                }, { status: 500 })
            }
            throw e
        }

        if (!subtask) {
            return NextResponse.json({ message: "Subtask not found" }, { status: 404 })
        }

        // Validate assignedToId if provided - must be one of parent task assignees
        if (assignedToId !== undefined && assignedToId !== null) {
            const isValidAssignee = subtask.task.assignees.some((a: { id: string }) => a.id === assignedToId)
            if (!isValidAssignee) {
                return NextResponse.json({ message: "Assigned user must be one of the parent task's assignees" }, { status: 400 })
            }
        }

        // Permission check
        let hasPermission = false
        if (session.user.role === "ADMIN") {
            hasPermission = true
        } else if (subtask.task.assignees.some((u: { id: string }) => u.id === session.user.id)) {
            hasPermission = true
        }

        if (!hasPermission) {
            return NextResponse.json({ message: "You don't have permission to update this subtask" }, { status: 403 })
        }

        // Update subtask - build update data dynamically
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {}
        if (title !== undefined) updateData.title = title
        if (isDone !== undefined) updateData.isDone = isDone
        if (priority !== undefined) updateData.priority = priority
        if (assignedToId !== undefined) updateData.assignedToId = assignedToId
        if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null

        const updated = await prismaAny.subTaskItem.update({
            where: { id },
            data: updateData,
            include: {
                assignedTo: {
                    select: { id: true, name: true, image: true }
                }
            }
        })

        return NextResponse.json(updated)
    } catch (error) {
        console.error("[UPDATE_SUBTASK_ERROR]", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        return NextResponse.json({
            message: "Error updating subtask",
            error: errorMessage
        }, { status: 500 })
    }
}

// DELETE: Delete a subtask
export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
        return NextResponse.json({ message: "Subtask ID is required" }, { status: 400 })
    }

    try {
        // Verify subtask exists and get task for permission check
        if (!('subTaskItem' in prisma) || !prisma.subTaskItem) {
            return NextResponse.json({
                message: "SubTaskItem model not available. Please stop your dev server, run: npx prisma db push && npx prisma generate, then restart the server."
            }, { status: 500 })
        }

        let subtask
        try {
            subtask = await prismaAny.subTaskItem.findUnique({
                where: { id },
                include: {
                    task: {
                        include: { assignees: { select: { id: true } } }
                    }
                }
            })
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : String(e)
            if (errorMessage.includes('SubTaskItem') || errorMessage.includes('Unknown model') || errorMessage.includes('Cannot read properties')) {
                return NextResponse.json({
                    message: "SubTaskItem model not available. Please stop your dev server, run: npx prisma db push && npx prisma generate, then restart the server."
                }, { status: 500 })
            }
            throw e
        }

        if (!subtask) {
            return NextResponse.json({ message: "Subtask not found" }, { status: 404 })
        }

        // Permission check
        let hasPermission = false
        if (session.user.role === "ADMIN") {
            hasPermission = true
        } else if (subtask.task.assignees.some((u: { id: string }) => u.id === session.user.id)) {
            hasPermission = true
        }

        if (!hasPermission) {
            return NextResponse.json({ message: "You don't have permission to delete this subtask" }, { status: 403 })
        }

        await prismaAny.subTaskItem.delete({ where: { id } })
        return NextResponse.json({ message: "Deleted" })
    } catch (error) {
        console.error("[DELETE_SUBTASK_ERROR]", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        return NextResponse.json({
            message: "Error deleting subtask",
            error: errorMessage
        }, { status: 500 })
    }
}
