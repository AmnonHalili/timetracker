
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const projectId = params.id
        const userId = session.user.id

        // 1. Check if the user is a member of the project
        const membership = await prisma.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId
                }
            }
        })

        if (!membership) {
            return NextResponse.json({ error: "Not a member of this project" }, { status: 404 })
        }

        // 2. If the user is an ADMIN, check if they are the last admin
        if (membership.role === "ADMIN") {
            const adminCount = await prisma.projectMember.count({
                where: {
                    projectId,
                    role: "ADMIN",
                    status: "ACTIVE"
                }
            })

            if (adminCount <= 1) {
                return NextResponse.json({
                    error: "LEAVE_ADMIN_ERROR",
                    message: "You are the last administrator of this workspace. You must promote another member to Admin or delete the workspace entirely."
                }, { status: 400 })
            }
        }

        // 3. Remove the membership
        await prisma.projectMember.delete({
            where: {
                projectId_userId: {
                    projectId,
                    userId
                }
            }
        })

        // 4. If this was the user's active project, update their active projectId
        if (session.user.projectId === projectId) {
            // Find another project the user is a member of
            const nextMembership = await prisma.projectMember.findFirst({
                where: {
                    userId,
                    status: "ACTIVE"
                },
                select: { projectId: true }
            })

            await prisma.user.update({
                where: { id: userId },
                data: {
                    projectId: nextMembership?.projectId || null
                }
            })
        }

        return NextResponse.json({ message: "Successfully left the workspace" })

    } catch (error) {
        console.error("Error leaving project:", error)
        return NextResponse.json({ error: "Failed to leave workspace" }, { status: 500 })
    }
}
