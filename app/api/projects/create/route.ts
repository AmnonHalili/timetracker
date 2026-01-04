
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const { name } = body

        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: "Project name is required" }, { status: 400 })
        }

        // Transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Project
            const project = await tx.project.create({
                data: {
                    name,
                    joinCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
                    // Default settings could be added here
                }
            })

            // 2. Create ProjectMember (Creator is ADMIN)
            await tx.projectMember.create({
                data: {
                    userId: session.user.id,
                    projectId: project.id,
                    role: 'ADMIN',
                    status: 'ACTIVE'
                }
            })

            // 3. Switch User Context
            await tx.user.update({
                where: { id: session.user.id },
                data: { projectId: project.id }
            })

            return project
        })

        return NextResponse.json(result)

    } catch (error) {
        console.error("Error creating project:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
