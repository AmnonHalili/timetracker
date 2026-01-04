
import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomBytes } from 'crypto'

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { name } = body

        if (!name || name.length < 2) {
            return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 })
        }

        // Generate unique join code
        const joinCode = randomBytes(3).toString('hex').toUpperCase()

        // Transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Project
            const project = await tx.project.create({
                data: {
                    name,
                    joinCode
                }
            })

            // 2. Add creator as Admin
            await tx.projectMember.create({
                data: {
                    userId: session.user.id,
                    projectId: project.id,
                    role: 'ADMIN',
                    status: 'ACTIVE'
                }
            })

            // 3. Switch context to new project
            await tx.user.update({
                where: { id: session.user.id },
                data: { projectId: project.id }
            })

            return project
        })

        return NextResponse.json({ success: true, project: result })

    } catch (error: any) {
        console.error("Error creating project:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
