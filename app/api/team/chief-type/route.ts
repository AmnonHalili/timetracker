import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const { userId, chiefType } = await req.json()

        if (!userId) {
            return NextResponse.json({ message: "User ID is required" }, { status: 400 })
        }

        if (!chiefType || !["partner", "independent"].includes(chiefType)) {
            return NextResponse.json({ message: "Invalid chief type. Must be 'partner' or 'independent'" }, { status: 400 })
        }

        // Get current user and target user
        let currentUser
        try {
            currentUser = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { id: true, role: true, projectId: true, managerId: true, sharedChiefGroupId: true }
            })
        } catch {
            currentUser = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { id: true, role: true, projectId: true, managerId: true }
            })
            if (currentUser) {
                currentUser = { ...currentUser, sharedChiefGroupId: null }
            }
        }

        let targetUser
        try {
            targetUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, role: true, managerId: true, projectId: true, sharedChiefGroupId: true }
            })
        } catch {
            targetUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, role: true, managerId: true, projectId: true }
            })
            if (targetUser) {
                targetUser = { ...targetUser, sharedChiefGroupId: null }
            }
        }

        if (!currentUser || !targetUser) {
            return NextResponse.json({ message: "User not found" }, { status: 404 })
        }

        // Only ADMIN can update chief type
        if (currentUser.role !== "ADMIN") {
            return NextResponse.json({ message: "Only admins can update chief type" }, { status: 403 })
        }

        // Must be in same project
        if (currentUser.projectId !== targetUser.projectId) {
            return NextResponse.json({ message: "Cannot update users from different projects" }, { status: 403 })
        }

        // Target user must be ADMIN
        if (targetUser.role !== "ADMIN") {
            return NextResponse.json({ message: "Chief type can only be set for ADMIN users" }, { status: 400 })
        }

        // Target user must not have a manager (top-level chief)
        if (targetUser.managerId) {
            return NextResponse.json({ message: "Chief type can only be set for top-level chiefs (no manager)" }, { status: 400 })
        }

        let sharedChiefGroupId: string | null = null

        if (chiefType === "partner") {
            // Partner (Shared Chief) logic
            // Use current user's sharedChiefGroupId or create a new one
            if (currentUser.managerId) {
                return NextResponse.json({
                    message: "Only top-level chiefs can add partners. You must be a root-level chief."
                }, { status: 400 })
            }

            // Use existing sharedChiefGroupId or create a new one
            const currentUserWithExtras = currentUser as { sharedChiefGroupId?: string | null }
            if (currentUserWithExtras.sharedChiefGroupId) {
                sharedChiefGroupId = currentUserWithExtras.sharedChiefGroupId
            } else {
                // Create a new shared group ID
                sharedChiefGroupId = `shared_${currentUser.id}_${Date.now()}`
                // Also update current user to have this shared group ID
                await prisma.user.update({
                    where: { id: currentUser.id },
                    data: { sharedChiefGroupId } as never
                })
            }
        } else if (chiefType === "independent") {
            // Independent Chief - no shared group
            sharedChiefGroupId = null
        }

        // Update target user
        await prisma.user.update({
            where: { id: userId },
            data: { sharedChiefGroupId } as never
        })

        return NextResponse.json({ success: true, sharedChiefGroupId })
    } catch (error) {
        console.error("Error updating chief type:", error)
        return NextResponse.json({ message: "Internal server error" }, { status: 500 })
    }
}

