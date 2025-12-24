import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildHierarchyTree, filterVisibleUsers } from "@/lib/hierarchy-utils"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                role: true,
                projectId: true,
                id: true,
                project: {
                    select: { name: true }
                }
            }
        })

        if (!currentUser?.projectId) {
            // Return just the current user for Private Workspace
            const privateUser = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    image: true,
                    managerId: true,
                    jobTitle: true,
                }
            })

            return NextResponse.json({
                users: privateUser ? [privateUser] : [],
                projectName: "Private Workspace"
            })
        }

        // Fetch all users in the project
        // We fetch flat list and build tree securely in memory or rely on relation
        // For deep nesting, Prisma recursion is limited, but we can fetch all and rebuild
        const allUsers = await prisma.user.findMany({
            where: { projectId: currentUser.projectId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                image: true,
                managerId: true,
                jobTitle: true,
                // We'll fetch flat and reconstruct for valid JSON tree
            },
            orderBy: { createdAt: "asc" }
        })

        return NextResponse.json({
            users: allUsers,
            projectName: currentUser.project?.name || "My Organization"
        })
    } catch (error) {
        console.error("[HIERARCHY_FETCH_ERROR]", error)
        return NextResponse.json({ message: "Failed to fetch hierarchy" }, { status: 500 })
    }
}
