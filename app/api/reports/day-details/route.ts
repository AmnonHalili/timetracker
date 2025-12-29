import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { startOfDay, endOfDay } from "date-fns"

export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId")
    const date = searchParams.get("date")

    if (!userId || !date) {
        return new NextResponse("Missing parameters", { status: 400 })
    }

    // Security Check: Verify user can view this user's data
    const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true, projectId: true, managerId: true }
    })

    if (!currentUser) return new NextResponse("Unauthorized", { status: 401 })

    // Check if target user is visible to current user
    const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, projectId: true, managerId: true, role: true }
    })

    if (!targetUser) {
        return new NextResponse("User not found", { status: 404 })
    }

    // Security: Only allow viewing if same user, admin/manager of same project, or in hierarchy
    if (targetUser.projectId !== currentUser.projectId) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    if (userId !== session.user.id && !["ADMIN", "MANAGER"].includes(currentUser.role)) {
        // Check hierarchy access
        const { filterVisibleUsers } = await import("@/lib/hierarchy-utils")
        const allProjectUsers = await prisma.user.findMany({
            where: { projectId: currentUser.projectId, status: "ACTIVE" },
            select: { id: true, name: true, email: true, managerId: true, role: true }
        })

        const secondaryRelations = await prisma.secondaryManager.findMany({
            where: { managerId: currentUser.id },
            select: { employeeId: true, managerId: true, permissions: true }
        })

        const visibleUsers = filterVisibleUsers(allProjectUsers, currentUser, secondaryRelations)
        if (!visibleUsers.some(u => u.id === userId)) {
            return new NextResponse("Forbidden", { status: 403 })
        }
    }

    // Parse date
    const targetDate = new Date(date)
    const dayStart = startOfDay(targetDate)
    const dayEnd = endOfDay(targetDate)

    // Fetch workday for this date
    const workday = await prisma.workday.findFirst({
        where: {
            userId: userId,
            workdayStartTime: {
                gte: dayStart,
                lte: dayEnd,
            },
        },
        orderBy: {
            workdayStartTime: 'desc'
        },
        select: {
            id: true,
            workdayStartTime: true,
            workdayEndTime: true,
        },
    })

    // Fetch all time entries for this day
    const timeEntries = await prisma.timeEntry.findMany({
        where: {
            userId: userId,
            startTime: {
                gte: dayStart,
                lte: dayEnd,
            },
        },
        orderBy: {
            startTime: 'asc'
        },
        select: {
            id: true,
            startTime: true,
            endTime: true,
            description: true,
            isManual: true,
            subtaskId: true,
            subtask: {
                select: {
                    id: true,
                    title: true,
                }
            },
            tasks: {
                select: {
                    id: true,
                    title: true,
                }
            },
            breaks: {
                select: {
                    id: true,
                    startTime: true,
                    endTime: true,
                    reason: true,
                },
                orderBy: {
                    startTime: 'asc'
                }
            }
        },
    })

    return NextResponse.json({
        workday,
        timeEntries,
        date: targetDate.toISOString()
    })
}

