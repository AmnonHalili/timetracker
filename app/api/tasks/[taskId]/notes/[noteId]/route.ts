import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function DELETE(req: Request, { params }: { params: { taskId: string; noteId: string } }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    try {
        const note = await prisma.taskNote.findUnique({
            where: { id: params.noteId }
        })

        if (!note) return NextResponse.json({ message: "Note not found" }, { status: 404 })

        if (note.userId !== session.user.id) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        await prisma.taskNote.delete({
            where: { id: params.noteId }
        })

        return NextResponse.json({ message: "Note deleted" })
    } catch (error) {
        return NextResponse.json({ message: "Failed to delete note" }, { status: 500 })
    }
}
