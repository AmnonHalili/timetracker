
import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { joinCode } = body

        if (!joinCode) {
            return NextResponse.json({ error: 'Join code is required' }, { status: 400 })
        }

        const normalizedCode = joinCode.toUpperCase().trim()

        const project = await prisma.project.findUnique({
            where: { joinCode: normalizedCode }
        })

        if (!project) {
            return NextResponse.json({ error: 'Invalid join code' }, { status: 404 })
        }

        // Check if already a member
        const existingMember = await prisma.projectMember.findUnique({
            where: {
                userId_projectId: {
                    userId: session.user.id,
                    projectId: project.id
                }
            }
        })

        if (existingMember) {
            return NextResponse.json({ error: 'Already a member of this project' }, { status: 409 })
        }

        // Create membership (PENDING by default)
        await prisma.projectMember.create({
            data: {
                userId: session.user.id,
                projectId: project.id,
                role: 'EMPLOYEE',
                status: 'PENDING'
            }
        })

        return NextResponse.json({ success: true, project })

    } catch (error: any) {
        console.error("Error joining project:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
