import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

// GET tasks is handled in the page server component usually, but if we need client fetch:
export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    // ... filtering logic if needed
    return NextResponse.json({ message: "Use Server Actions or Page Data" })
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 })

    try {
        const { title, assignedToIds, priority, deadline, description } = await req.json()

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

        // Create notification for the assignees
        // We do this in a loop or createMany if Notification supported it better, 
        // but User relation makes createMany tricky for Notifications usually implies single user relation 
        // actually Notification has userId.

        const notificationsData = (assignedToIds as string[]).map(id => ({
            userId: id,
            title: "New Task Assigned",
            message: `You have been assigned to task: "${title}"`,
            type: "INFO" as const
        }))

        // createMany is supported for simple models
        await prisma.notification.createMany({
            data: notificationsData
        })

        return NextResponse.json(task)
    } catch (e) {
        return NextResponse.json({ message: "Error creating task" }, { status: 500 })
    }
}

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    try {
        const { id, status, isCompleted, priority, deadline } = await req.json()

        // Handle legacy isCompleted toggle if sent
        let newStatus = status
        if (isCompleted !== undefined && !status) {
            newStatus = isCompleted ? "DONE" : "TODO"
        }

        // The provided snippet for the where clause seems to be intended for a GET/find operation
        // and is syntactically incorrect within the data object of an update.
        // Assuming the intent was to add a condition to the `where` clause of the update,
        // but without `currentUser` or `projectId` defined in this scope,
        // and to maintain syntactic correctness, the provided snippet cannot be directly inserted
        // as-is into the `data` object.
        //
        // If the intention was to restrict updates based on user roles/project,
        // the `where` clause would need to be constructed dynamically before the update call,
        // or additional checks would be needed.
        //
        // Given the instruction "Update where clause" and the provided snippet,
        // and to avoid syntax errors, I will interpret this as an attempt to modify
        // the `where` object. However, the provided code snippet itself is not a valid
        // `where` clause for an update and contains conditional logic that doesn't fit
        // directly into the `where` object.
        //
        // To make a faithful and syntactically correct change based on the provided snippet,
        // which appears to be a misplaced `where` clause construction,
        // I will place it as a comment to indicate where such logic might go,
        // as directly inserting it would break the code.
        //
        // If the user intended to add a specific `where` condition to the `update` operation,
        // please provide the exact `where` object structure.

        const task = await prisma.task.update({
            where: {
                id,
                // if (currentUser.role === "ADMIN" && currentUser.projectId) {
                //     // Admin sees all tasks in the project
                //     // We need tasks where at least one assignee is in the project
                //     whereClause = {
                //         assignees: {
                //             some: {
                //                 projectId: currentUser.projectId
                //             }
                //         }
                //     }
                // } else {
                //     // Regular user sees only their tasks
                //     whereClause = {
                //         assignees: {
                //             some: {
                //                 id: session.user.id
                //             }
                //         }
                //     }
                // }
            },
            data: {
                status: newStatus,
                isCompleted: newStatus === "DONE", // Keep synced for now
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
    } catch (e) {
        return NextResponse.json({ message: "Error updating task" }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) return NextResponse.json({ message: "Missing ID" }, { status: 400 })

    await prisma.task.delete({ where: { id } })
    return NextResponse.json({ message: "Deleted" })
}
