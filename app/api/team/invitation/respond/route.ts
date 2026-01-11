import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const { projectId, action } = await req.json()

        if (!projectId || !action) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 })
        }

        const membership = await prisma.projectMember.findUnique({
            where: {
                userId_projectId: {
                    userId: session.user.id,
                    projectId
                }
            }
        })

        if (!membership) {
            return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
        }

        if (membership.status !== "INVITED") {
            return NextResponse.json({ error: "Invalid invitation status" }, { status: 400 })
        }

        if (action === "ACCEPT") {
            // Get the role from ProjectMember
            const userRole = membership.role || "EMPLOYEE"

            // Calculate sharedChiefGroupId for ADMIN role
            let sharedChiefGroupId: string | null = null
            let finalManagerId: string | null = null

            if (userRole === "ADMIN") {
                // For ADMIN, check if there are other top-level admins in the project
                // If yes, use their sharedChiefGroupId (Partner logic)
                // If no, set to null (Independent)
                try {
                    const topLevelAdmins = await prisma.user.findMany({
                        where: {
                            projectId: projectId,
                            role: "ADMIN",
                            managerId: null, // Top-level only
                            id: { not: session.user.id } // Exclude current user
                        },
                        select: {
                            id: true,
                            sharedChiefGroupId: true
                        } as never,
                        take: 1 // Get first one
                    }) as Array<{ id: string; sharedChiefGroupId?: string | null }>

                    if (topLevelAdmins.length > 0 && topLevelAdmins[0].sharedChiefGroupId) {
                        // Use existing sharedChiefGroupId (Partner)
                        sharedChiefGroupId = topLevelAdmins[0].sharedChiefGroupId
                    } else if (topLevelAdmins.length > 0) {
                        // There's a top-level admin but no sharedChiefGroupId - create one
                        sharedChiefGroupId = `shared-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
                        // Update the existing admin with the new sharedChiefGroupId
                        await prisma.user.update({
                            where: { id: topLevelAdmins[0].id },
                            data: { sharedChiefGroupId } as Record<string, unknown>
                        })
                    } else {
                        // No other top-level admins - this is an Independent admin
                        sharedChiefGroupId = null
                    }
                } catch (error) {
                    // If sharedChiefGroupId field doesn't exist, just set to null
                    console.warn("Could not determine sharedChiefGroupId, defaulting to null:", error)
                    sharedChiefGroupId = null
                }
            }

            // Update User record with project information
            const updateData: Record<string, unknown> = {
                projectId: projectId,
                role: userRole,
                status: "ACTIVE",
                managerId: finalManagerId
            }

            if (userRole === "ADMIN" && sharedChiefGroupId !== undefined) {
                updateData.sharedChiefGroupId = sharedChiefGroupId
            }

            await prisma.user.update({
                where: { id: session.user.id },
                data: updateData as never
            })

            // Update ProjectMember status to ACTIVE
            await prisma.projectMember.update({
                where: { id: membership.id },
                data: { status: "ACTIVE", joinedAt: new Date() }
            })

            // Revalidate team pages
            revalidatePath("/team")
            revalidatePath("/team/hierarchy")

            return NextResponse.json({ success: true, message: "Invitation accepted" })
        } else if (action === "REJECT") {
            await prisma.projectMember.update({
                where: { id: membership.id },
                data: { status: "REJECTED" }
            })
            return NextResponse.json({ success: true, message: "Invitation rejected" })
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    } catch (error) {
        console.error("Error responding to invitation:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
