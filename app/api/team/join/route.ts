import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const { projectName } = await req.json()
        if (!projectName) {
            return NextResponse.json({ message: "Project Name is required" }, { status: 400 })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id }
        })

        if (user?.projectId) {
            return NextResponse.json({ message: "You are already in a project" }, { status: 400 })
        }

        const project = await prisma.project.findFirst({
            where: {
                name: {
                    equals: projectName,
                    mode: 'insensitive'
                }
            }
        })

        if (!project) {
            return NextResponse.json({ message: "Project not found" }, { status: 404 })
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                pendingProjectId: project.id
            }
        })

        // Notify Admins
        const admins = await prisma.user.findMany({
            where: {
                projectId: project.id,
                role: "ADMIN"
            }
        })

        if (admins.length > 0) {
            await prisma.notification.createMany({
                data: admins.map(admin => ({
                    userId: admin.id,
                    title: "New Join Request",
                    message: `${user?.name} has requested to join your project.`,
                    type: "INFO",
                    link: "/team/hierarchy"
                }))
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to join team:", error)
        return NextResponse.json({ message: "Internal Error" }, { status: 500 })
    }
}
