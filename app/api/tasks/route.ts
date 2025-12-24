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
        const { title, assignedToIds, priority, deadline, description } = body

        // Validate permissions
        // ADMIN: Can assign to anyone (in project? logic handled by frontend usually, but good to enforce project scope if strict)
        // MANAGER: Can assign to descendants
        // EMPLOYEE / NO ROLE: Can only assign to SELF

        if (session.user.role !== "ADMIN") {
            // If manager, check descendants. If neither, check self.
            const currentUser = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { id: true, projectId: true }
            })

            const targetIds = new Set(assignedToIds as string[])

            if (session.user.role === "MANAGER" && currentUser?.projectId) {
                const allUsers = await prisma.user.findMany({
                    where: { projectId: currentUser.projectId },
                    select: { id: true, managerId: true }
                })
                // Cast to partial type allowed by utils if strictly typed, or fetch needed fields. 
                // Assuming getAllDescendants just needs structure. It seems it expects full User type in signature but only uses id/managerId.
                // Let's use 'as any' safely here or better, update the helper file if possible. 
                // For now, let's just cast to 'any' to avoid the strict type check against the full User model if the helper creates issues.
                const descendants = getAllDescendants(currentUser.id, allUsers as any)
                const allowedIds = new Set([currentUser.id, ...descendants])

                if (!Array.from(targetIds).every(id => allowedIds.has(id))) {
                    return NextResponse.json({ message: "Cannot assign tasks to users outside your hierarchy" }, { status: 403 })
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
                assignees: {
                    connect: (assignedToIds as string[]).map(id => ({ id }))
                },
                priority: priority || "MEDIUM",
                deadline: deadline ? new Date(deadline) : null,
                description,
                status: "TODO"
            },
            include: {
                assignees: true
            }
        })

        // ... notification logic (kept simple or improved)
        const notificationsData = (assignedToIds as string[]).map(id => ({
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
        const { id, status, isCompleted, priority, deadline } = await req.json()

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
    } catch {
        return NextResponse.json({ message: "Error updating task" }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    // Admin can delete, Manager checks hierarchy
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) return NextResponse.json({ message: "Missing ID" }, { status: 400 })

    if (session.user.role === "MANAGER") {
        // Check if manager manages the task assignees
        // Ideally, we should check if they manage ALL assignees or just one? 
        // For now, if they manage at least one or created permissions... but simpler: 
        // Only ADMIN delete for now to be safe, or check hierarchy completely. 
        // User asked to "manage" permissions. 
        // Let's implement full check: Manager can delete if ALL assignees are in their subtree (or task has no assignees but belongs to project?). 
        // It's safer to leave DELETE to ADMIN for now or implement strict check. 
        // Let's stick to ADMIN only for DELETE to avoid data loss accidents by managers, unless requested.
        // Actually user said "missions and everything". 
        // Let's allow MANAGER if permission check passes similar to PATCH but stricter (all assignees).

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

        const descendants = new Set(getAllDescendants(currentUser!.id, allUsers))
        const isManagerOfAll = task.assignees.every(u => descendants.has(u.id) || u.id === currentUser!.id)

        if (!isManagerOfAll) return NextResponse.json({ message: "Forbidden: Task involves users outside your management" }, { status: 403 })
    }

    await prisma.task.delete({ where: { id } })
    return NextResponse.json({ message: "Deleted" })
}
