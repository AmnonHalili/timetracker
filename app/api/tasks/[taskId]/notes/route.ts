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
        include: { user: { select: { id: true, name: true, image: true } } }
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
            include: { user: { select: { id: true, name: true, image: true } } }
        })

        // Handle Mentions
        const mentionRegex = /@([a-zA-Z0-9\u0590-\u05FF]+)/g // Basic mention regex (no spaces for now)
        const mentionNames = Array.from(content.matchAll(mentionRegex), (m: RegExpMatchArray) => m[1])

        if (mentionNames.length > 0) {
            // Find users in the same project who might have these names
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
                            id: { not: session.user.id } // Don't notify self
                        },
                        select: { id: true }
                    })

                    if (projectUsers.length > 0) {
                        await prisma.notification.createMany({
                            data: projectUsers.map(u => ({
                                userId: u.id,
                                title: "You were mentioned",
                                message: `${session.user.name} mentioned you in task: "${task.title}"`,
                                link: `/tasks?taskId=${params.taskId}&noteId=${note.id}`,
                                type: "INFO"
                            }))
                        })
                    }
                }
            }
        }

        await logActivity(params.taskId, session.user.id, "COMMENT_ADDED", "Added a note")

        return NextResponse.json(note)
    } catch (error) {
        console.error("Error creating note:", error)
        return NextResponse.json({ message: "Failed to create note" }, { status: 500 })
    }
}
