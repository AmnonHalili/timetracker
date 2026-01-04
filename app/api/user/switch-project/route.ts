
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
        const { projectId } = body

        if (!projectId) {
            return NextResponse.json({ error: 'ProjectId is required' }, { status: 400 })
        }

        // Verify membership
        const membership = await prisma.projectMember.findUnique({
            where: {
                userId_projectId: {
                    userId: session.user.id,
                    projectId: projectId
                }
            }
        })

        if (!membership) {
            return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
        }

        // Update active project on User
        await prisma.user.update({
            where: { id: session.user.id },
            data: { projectId: projectId }
        })

        return NextResponse.json({ success: true })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error("Error switching project:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
