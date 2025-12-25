import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { projectId: true, role: true }
        })

        if (!currentUser?.projectId) {
            return NextResponse.json({ message: "Project not found" }, { status: 404 })
        }

        // Fetch all users in the project
        const users = await prisma.user.findMany({
            where: {
                projectId: currentUser.projectId,
                status: "ACTIVE" // Only active users? Or all? Let's say all for now or PENDING too.
            },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true,
                jobTitle: true
            },
            orderBy: {
                name: 'asc'
            }
        })

        return NextResponse.json(users)
    } catch (error) {
        console.error("[TEAM_GET_ERROR]", error)
        return NextResponse.json({ message: "Internal server error" }, { status: 500 })
    }
}
