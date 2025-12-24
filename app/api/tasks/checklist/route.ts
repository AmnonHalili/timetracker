import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    try {
        const { taskId, text } = await req.json()
        if (!taskId || !text) return NextResponse.json({ message: "Missing fields" }, { status: 400 })

        const item = await prisma.checklistItem.create({
            data: { taskId, text }
        })

        return NextResponse.json(item)
    } catch (error) {
        console.error("Error creating checklist item:", error)
        return NextResponse.json({ message: "Failed to create item" }, { status: 500 })
    }
}

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    try {
        const { id, isDone } = await req.json()
        if (!id || typeof isDone !== 'boolean') return NextResponse.json({ message: "Missing fields" }, { status: 400 })

        const item = await prisma.checklistItem.update({
            where: { id },
            data: { isDone }
        })

        return NextResponse.json(item)
    } catch (error) {
        console.error("Error updating checklist item:", error)
        return NextResponse.json({ message: "Failed to update item" }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get("id")

        if (!id) return NextResponse.json({ message: "Missing ID" }, { status: 400 })

        await prisma.checklistItem.delete({
            where: { id }
        })

        return NextResponse.json({ message: "Deleted" })
    } catch (error) {
        console.error("Error deleting checklist item:", error)
        return NextResponse.json({ message: "Failed to delete item" }, { status: 500 })
    }
}
