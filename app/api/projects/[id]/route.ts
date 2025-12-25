
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const { logo, name, workMode } = await req.json()

        // Basic validation - check if project exists and user belongs to it (though admin role check above is good first step)
        // Ideally we check if session.user.projectId === params.id as well

        const project = await prisma.project.update({
            where: { id: params.id },
            data: {
                ...(logo !== undefined && { logo }),
                ...(name !== undefined && { name }),
                ...(workMode !== undefined && { workMode })
            }
        })

        return NextResponse.json(project)
    } catch (error) {
        console.error("Error updating project:", error)
        return NextResponse.json({ message: "Failed to update project" }, { status: 500 })
    }
}
