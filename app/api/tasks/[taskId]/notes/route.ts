import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { logActivity } from "@/lib/activity"

export async function GET(req: Request, { params }: { params: { taskId: string } }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    const notes = await prisma.taskNote.findMany({
        where: { taskId: params.taskId },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, image: true } } }
    })

    return NextResponse.json(notes)
}

export async function POST(req: Request, { params }: { params: { taskId: string } }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    try {
        const { content } = await req.json()
        if (!content) return NextResponse.json({ message: "Content required" }, { status: 400 })

        const note = await prisma.taskNote.create({
            data: {
                taskId: params.taskId,
                userId: session.user.id,
                content,
            },
            include: { user: { select: { name: true, image: true } } }
        })

        await logActivity(params.taskId, session.user.id, "COMMENT_ADDED", "Added a note")

        return NextResponse.json(note)
    } catch {
        return NextResponse.json({ message: "Failed to create note" }, { status: 500 })
    }
}
