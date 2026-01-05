import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/hierarchy-utils"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Verify user permissions
    const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id }
    })

    if (!currentUser) {
        return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    try {
        const { userId, dailyTarget, workDays, weeklyHours } = await req.json()

        if (!userId) {
            return NextResponse.json({ message: "User ID is required" }, { status: 400 })
        }

        // Validate weeklyHours if provided
        if (weeklyHours !== undefined) {
            if (typeof weeklyHours !== 'object' || weeklyHours === null || Array.isArray(weeklyHours)) {
                return NextResponse.json({ message: "Invalid weekly hours format" }, { status: 400 })
            }
            // Validate each day (0-6) and hours (>= 0)
            for (const [dayStr, hours] of Object.entries(weeklyHours)) {
                const day = parseInt(dayStr)
                if (isNaN(day) || day < 0 || day > 6) {
                    return NextResponse.json({ message: `Invalid day: ${dayStr}` }, { status: 400 })
                }
                if (typeof hours !== 'number' || hours < 0) {
                    return NextResponse.json({ message: `Invalid hours for day ${dayStr}` }, { status: 400 })
                }
            }
        }

        // Legacy support: still accept dailyTarget and workDays for backward compatibility
        if (dailyTarget !== null && (typeof dailyTarget !== 'number' || dailyTarget < 0)) {
            return NextResponse.json({ message: "Invalid daily target" }, { status: 400 })
        }

        if (workDays && (!Array.isArray(workDays) || !workDays.every((d: unknown) => typeof d === 'number' && d >= 0 && d <= 6))) {
            return NextResponse.json({ message: "Invalid work days" }, { status: 400 })
        }

        // Verify the user belongs to the same project and check permissions
        const targetUser = await prisma.user.findUnique({
            where: { id: userId }
        })

        if (!targetUser || targetUser.projectId !== currentUser.projectId) {
            return NextResponse.json({ message: "Forbidden: User not in your project" }, { status: 403 })
        }

        // Check if current user can manage target user
        const allUsers = await prisma.user.findMany({
            where: { projectId: currentUser.projectId }
        })

        // Fetch secondary manager relationships for permission check
        const secondaryRelations = await prisma.secondaryManager.findMany({
            where: { employeeId: userId },
            select: { employeeId: true, managerId: true, permissions: true }
        })

        if (!checkPermission(currentUser.id, userId, 'EDIT_SETTINGS', allUsers, secondaryRelations)) {
            return NextResponse.json({ message: "Forbidden: You don't have permission to edit work settings for this user" }, { status: 403 })
        }

        const updateData: {
            dailyTarget?: number | null
            workDays?: number[]
            weeklyHours?: Record<string, number>
        } = {}

        if (weeklyHours !== undefined) {
            updateData.weeklyHours = weeklyHours
        } else if (dailyTarget !== undefined || workDays !== undefined) {
            // Legacy format
            if (dailyTarget !== undefined) updateData.dailyTarget = dailyTarget
            if (workDays !== undefined) updateData.workDays = workDays
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: { id: true, dailyTarget: true, workDays: true, weeklyHours: true }
        })

        return NextResponse.json({ user: updatedUser, message: "Work settings updated successfully" })
    } catch (error) {
        console.error("[TEAM_WORK_SETTINGS_UPDATE_ERROR]", error)
        return NextResponse.json({ message: "Failed to update work settings" }, { status: 500 })
    }
}
