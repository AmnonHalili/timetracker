import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Verify admin or manager role
    const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, projectId: true, id: true }
    })

    if (!currentUser || !["ADMIN", "MANAGER"].includes(currentUser.role)) {
        return NextResponse.json({ message: "Forbidden: Admin or Manager access required" }, { status: 403 })
    }

    try {
        const { userId, newAdminId } = await req.json()

        if (!userId) {
            return NextResponse.json({ message: "User ID is required" }, { status: 400 })
        }

        // Verify the user belongs to the same project
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { projectId: true, role: true, id: true }
        })

        if (targetUser?.projectId !== currentUser.projectId) {
            return NextResponse.json({ message: "Forbidden: User not in your project" }, { status: 403 })
        }

        // Check if deleting the last admin
        if (targetUser?.role === "ADMIN") {
            const adminCount = await prisma.user.count({
                where: {
                    projectId: currentUser.projectId,
                    role: "ADMIN"
                }
            })

            if (adminCount <= 1) {
                // If deleting self and no new admin provided, require admin transfer
                if (userId === session.user.id && !newAdminId) {
                    return NextResponse.json({
                        requiresAdminTransfer: true,
                        message: "Please select a new admin before deleting your account."
                    }, { status: 400 })
                }

                // If new admin provided, transfer and delete in transaction
                if (newAdminId) {
                    // Verify new admin is in same project
                    const newAdmin = await prisma.user.findUnique({
                        where: { id: newAdminId },
                        select: { projectId: true }
                    })

                    if (newAdmin?.projectId !== currentUser.projectId) {
                        return NextResponse.json({ message: "Invalid new admin selection" }, { status: 400 })
                    }

                    // Perform transfer and remove from team in transaction
                    await prisma.$transaction([
                        prisma.user.update({
                            where: { id: newAdminId },
                            data: { role: "ADMIN" }
                        }),
                        prisma.user.update({
                            where: { id: userId },
                            data: {
                                projectId: null,
                                managerId: null,
                                sharedChiefGroupId: null,
                            }
                        })
                    ])

                    // Remove secondary manager relationships
                    try {
                        await prisma.secondaryManager.deleteMany({
                            where: {
                                OR: [
                                    { employeeId: userId },
                                    { managerId: userId }
                                ]
                            }
                        })
                    } catch (error) {
                        console.warn("Could not remove secondary manager relationships:", error)
                    }

                    return NextResponse.json({ message: "Admin transferred and user removed from team successfully" })
                }

                // Prevent deletion without transfer
                return NextResponse.json({
                    message: "Cannot delete: This is the only admin in the project."
                }, { status: 400 })
            }
        }

        // Remove user from team instead of deleting
        // Set projectId to null, clear manager relationships, but keep the user account active
        await prisma.user.update({
            where: { id: userId },
            data: {
                projectId: null,
                managerId: null,
                sharedChiefGroupId: null,
                // Keep status as ACTIVE so they can still log in
                // They will see the "join or create team" screen
            }
        })

        // Also remove any secondary manager relationships
        try {
            await prisma.secondaryManager.deleteMany({
                where: {
                    OR: [
                        { employeeId: userId },
                        { managerId: userId }
                    ]
                }
            })
        } catch (error) {
            // If secondaryManager doesn't exist, continue
            console.warn("Could not remove secondary manager relationships:", error)
        }

        return NextResponse.json({ message: "User removed from team successfully" })
    } catch (error) {
        console.error("[TEAM_USER_DELETE_ERROR]", error)
        return NextResponse.json({ message: "Failed to delete user" }, { status: 500 })
    }
}
