import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const { newAdminId } = await req.json()

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                role: true,
                projectId: true
            }
        })

        if (!currentUser) {
            return NextResponse.json({ message: "User not found" }, { status: 404 })
        }

        // If user is an ADMIN, check if they're the last admin
        if (currentUser.role === "ADMIN" && currentUser.projectId) {
            const adminCount = await prisma.user.count({
                where: {
                    projectId: currentUser.projectId,
                    role: "ADMIN"
                }
            })

            if (adminCount <= 1) {
                // Check if they are the ONLY member (solo project or just last person left)
                const memberCount = await prisma.projectMember.count({
                    where: {
                        projectId: currentUser.projectId,
                        status: { not: "REJECTED" }
                    }
                })

                if (memberCount <= 1) {
                    // Solo admin - Delete User first (clears references), then Project
                    await prisma.$transaction([
                        prisma.user.delete({ where: { id: currentUser.id } }),
                        prisma.project.delete({ where: { id: currentUser.projectId } })
                    ])
                    return NextResponse.json({ message: "Account and personal workspace deleted successfully" })
                }

                // If no new admin provided, require admin transfer
                if (!newAdminId) {
                    return NextResponse.json({
                        requiresAdminTransfer: true,
                        message: "Please select a new admin before deleting your account."
                    }, { status: 400 })
                }

                // Verify new admin is in same project
                const newAdmin = await prisma.user.findUnique({
                    where: { id: newAdminId },
                    select: { projectId: true, id: true }
                })

                if (!newAdmin || newAdmin.projectId !== currentUser.projectId) {
                    return NextResponse.json({ message: "Invalid new admin selection" }, { status: 400 })
                }

                // Perform transfer and delete in transaction
                await prisma.$transaction([
                    prisma.user.update({
                        where: { id: newAdminId },
                        data: { role: "ADMIN" }
                    }),
                    prisma.user.delete({
                        where: { id: currentUser.id }
                    })
                ])

                return NextResponse.json({ message: "Admin transferred and account deleted successfully" })
            }
        }

        // Delete the user (normal flow - not last admin or not admin)
        await prisma.user.delete({
            where: { id: currentUser.id }
        })

        return NextResponse.json({ message: "Account deleted successfully" })
    } catch (error) {
        console.error("[USER_DELETE_ERROR]", error)
        return NextResponse.json({ message: "Failed to delete account" }, { status: 500 })
    }
}

