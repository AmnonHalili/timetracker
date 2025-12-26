import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

// POST: Create a subtask item
export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    try {
        const { taskId, title } = await req.json()

        if (!taskId || !title) {
            return NextResponse.json({ message: "Task ID and title are required" }, { status: 400 })
        }

        // Verify task exists and user has permission
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { assignees: { select: { id: true } } }
        })

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
            
            subtask = await (prisma as any).subTaskItem.create({
                data: { taskId, title }
            })
        } catch (e: any) {
            // If SubTaskItem model doesn't exist yet, return error with helpful message
            if (e.message?.includes('SubTaskItem') || e.message?.includes('Unknown model') || e.message?.includes('Cannot read properties')) {
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
        const { id, isDone } = await req.json()

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
            subtask = await (prisma as any).subTaskItem.findUnique({
                where: { id },
                include: {
                    task: {
                        include: { assignees: { select: { id: true } } }
                    }
                }
            })
        } catch (e: any) {
            if (e.message?.includes('SubTaskItem') || e.message?.includes('Unknown model') || e.message?.includes('Cannot read properties')) {
                return NextResponse.json({ 
                    message: "SubTaskItem model not available. Please run: npx prisma db push && npx prisma generate" 
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
        } else if (subtask.task.assignees.some(u => u.id === session.user.id)) {
            hasPermission = true
        }

        if (!hasPermission) {
            return NextResponse.json({ message: "You don't have permission to update this subtask" }, { status: 403 })
        }

        // Update subtask
        const updated = await (prisma as any).subTaskItem.update({
            where: { id },
            data: { isDone: isDone || false }
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
            subtask = await (prisma as any).subTaskItem.findUnique({
                where: { id },
                include: {
                    task: {
                        include: { assignees: { select: { id: true } } }
                    }
                }
            })
        } catch (e: any) {
            if (e.message?.includes('SubTaskItem') || e.message?.includes('Unknown model') || e.message?.includes('Cannot read properties')) {
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
        } else if (subtask.task.assignees.some(u => u.id === session.user.id)) {
            hasPermission = true
        }

        if (!hasPermission) {
            return NextResponse.json({ message: "You don't have permission to delete this subtask" }, { status: 403 })
        }

        await (prisma as any).subTaskItem.delete({ where: { id } })
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
