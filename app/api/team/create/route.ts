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

        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 })
        }

        if (user.projectId) {
            return NextResponse.json({ message: "You are already in a project" }, { status: 400 })
        }

        const project = await prisma.project.create({
            data: { name: projectName }
        })

        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                projectId: project.id,
                role: "ADMIN",
                status: "ACTIVE",
                // Set default jobTitle to "Founder" when user creates a team (if not already set)
                jobTitle: user.jobTitle || "Founder"
            }
        })

        return NextResponse.json({ success: true, projectId: project.id })
    } catch (error) {
        console.error("Failed to create team:", error)
        return NextResponse.json({ message: "Internal Error" }, { status: 500 })
    }
}
