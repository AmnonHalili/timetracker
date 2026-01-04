
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Fetch projects where user is a member
        const memberships = await prisma.projectMember.findMany({
            where: {
                userId: session.user.id
            },
            include: {
                project: true
            }
        })

        const projects = memberships.map(m => ({
            ...m.project,
            role: m.role // Include the role in the project
        }))

        return NextResponse.json(projects)
    } catch (error) {
        console.error("Error fetching projects:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
