
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
        const { projectId } = body

        if (!projectId) {
            return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
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
            return NextResponse.json({ error: "Not a member of this project" }, { status: 403 })
        }

        // Update active project
        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                projectId: projectId,
                role: membership.role
            }
        })

        return NextResponse.json({ success: true, role: membership.role })
    } catch (error) {
        console.error("Error switching project:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
