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
        const { title, assignedToId, priority, deadline, description } = await req.json()

        if (!title || !assignedToId) {
            return NextResponse.json({ message: "Missing fields" }, { status: 400 })
        }

        const task = await prisma.task.create({
            data: {
                title,
                assignedToId,
                priority: priority || "MEDIUM",
                deadline: deadline ? new Date(deadline) : null,
                description,
                status: "TODO"
            }
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

        const task = await prisma.task.update({
            where: { id },
            data: {
                status: newStatus,
                isCompleted: newStatus === "DONE", // Keep synced for now
                priority,
                deadline: deadline ? new Date(deadline) : undefined
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
