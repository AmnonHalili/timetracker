import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

// GET: Fetch tasks
// Admin: All tasks
// User: Only assigned tasks
export async function GET(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const where = session.user.role === "ADMIN"
            ? {}
            : { assignedToId: session.user.id }

        const tasks = await prisma.task.findMany({
            where,
            include: { assignedTo: { select: { name: true, email: true } } },
            orderBy: { createdAt: "desc" }
        })

        return NextResponse.json({ tasks })
    } catch (error) {
        return NextResponse.json({ message: "Error fetching tasks" }, { status: 500 })
    }
}

// POST: Create Task (Admin Only)
export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ message: "Unauthorized" }, { status: 403 })
    }

    const { title, assignedToId } = await req.json()

    if (!title || !assignedToId) {
        return NextResponse.json({ message: "Missing fields" }, { status: 400 })
    }

    try {
        const task = await prisma.task.create({
            data: {
                title,
                assignedToId,
                isCompleted: false,
            }
        })
        return NextResponse.json({ task })
    } catch (error) {
        return NextResponse.json({ message: "Error creating task" }, { status: 500 })
    }
}

// PATCH: Toggle Completion (Any assigned user or Admin)
export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { id, isCompleted } = await req.json()

    try {
        // Check permission
        const task = await prisma.task.findUnique({ where: { id } })

        if (!task) return NextResponse.json({ message: "Task not found" }, { status: 404 })

        if (session.user.role !== "ADMIN" && task.assignedToId !== session.user.id) {
            return NextResponse.json({ message: "Not allowed" }, { status: 403 })
        }

        const updated = await prisma.task.update({
            where: { id },
            data: { isCompleted }
        })

        return NextResponse.json({ task: updated })
    } catch (error) {
        return NextResponse.json({ message: "Error updating task" }, { status: 500 })
    }
}

// DELETE: Remove Task (Admin Only)
export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ message: "Unauthorized" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) return NextResponse.json({ message: "Missing ID" }, { status: 400 })

    try {
        await prisma.task.delete({ where: { id } })
        return NextResponse.json({ message: "Deleted" })
    } catch (error) {
        return NextResponse.json({ message: "Error deleting task" }, { status: 500 })
    }
}
