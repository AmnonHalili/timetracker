import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, { params }: { params: { taskId: string; noteId: string } }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    try {
        const { content } = await req.json()
        if (!content) return NextResponse.json({ message: "Content required" }, { status: 400 })

        const note = await prisma.taskNote.findUnique({
            where: { id: params.noteId }
        })

        if (!note) return NextResponse.json({ message: "Note not found" }, { status: 404 })

        if (note.userId !== session.user.id) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        const updatedNote = await prisma.taskNote.update({
            where: { id: params.noteId },
            data: { content },
            include: { user: { select: { id: true, name: true, image: true } } }
        })

        // Handle Mentions on update
        const mentionRegex = /@([a-zA-Z0-9\u0590-\u05FF]+)/g
        const mentionNames = Array.from(content.matchAll(mentionRegex), (m: any) => m[1])

        if (mentionNames.length > 0) {
            const task = await prisma.task.findUnique({
                where: { id: params.taskId },
                select: { title: true, assignees: { select: { projectId: true } } }
            })

            if (task) {
                const projectId = task.assignees[0]?.projectId
                if (projectId) {
                    const projectUsers = await prisma.user.findMany({
                        where: {
                            projectId,
                            name: { in: mentionNames },
                            id: { not: session.user.id }
                        },
                        select: { id: true }
                    })

                    if (projectUsers.length > 0) {
                        await prisma.notification.createMany({
                            data: projectUsers.map(u => ({
                                userId: u.id,
                                title: "You were mentioned",
                                message: `${session.user.name} mentioned you in an updated note in task: "${task.title}"`,
                                link: `/tasks?taskId=${params.taskId}&noteId=${params.noteId}`,
                                type: "INFO"
                            }))
                        })
                    }
                }
            }
        }

        return NextResponse.json(updatedNote)
    } catch (error) {
        console.error("Error updating note:", error)
        return NextResponse.json({ message: "Failed to update note" }, { status: 500 })
    }
}

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
    } catch {
        return NextResponse.json({ message: "Failed to delete note" }, { status: 500 })
    }
}
