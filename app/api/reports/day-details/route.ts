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

    // Parse date - handle YYYY-MM-DD format properly to avoid timezone issues
    // When date is "2025-12-30", we want to get the start/end of that day in local timezone
    let targetDate: Date
    if (date.includes('T')) {
        targetDate = new Date(date)
    } else {
        // If it's YYYY-MM-DD format, parse it in local timezone
        // Split and create date in local timezone to avoid UTC conversion issues
        const [year, month, day] = date.split('-').map(Number)
        targetDate = new Date(year, month - 1, day, 0, 0, 0, 0) // Local timezone
    }

    const dayStart = startOfDay(targetDate)
    const dayEnd = endOfDay(targetDate)

    // Log for debugging
    console.log(`[day-details] Date param: ${date}, Parsed targetDate: ${targetDate.toISOString()}, DayStart: ${dayStart.toISOString()}, DayEnd: ${dayEnd.toISOString()}`)

    // Fetch workday for this date
    const workday = await prisma.workday.findFirst({
        where: {
            userId: userId,
            workdayStartTime: {
                gte: dayStart,
                lte: dayEnd,
            },
            projectId: currentUser.projectId,
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
    // Include both completed entries (with endTime) and active entries (without endTime)
    // Query by startTime to get all entries that started on this day
    const nextDayStart = new Date(dayEnd)
    nextDayStart.setMilliseconds(nextDayStart.getMilliseconds() + 1) // Start of next day

    const timeEntries = await prisma.timeEntry.findMany({
        where: {
            userId: userId,
            projectId: currentUser.projectId,
            startTime: {
                gte: dayStart,
                lt: nextDayStart, // Less than start of next day
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

    // Log for debugging
    console.log(`[day-details] Found ${timeEntries.length} time entries for user ${userId} on ${date}`)
    if (timeEntries.length > 0) {
        console.log(`[day-details] Entry times:`, timeEntries.map(e => ({
            id: e.id,
            startTime: e.startTime,
            endTime: e.endTime
        })))
    }

    return NextResponse.json({
        workday,
        timeEntries,
        date: targetDate.toISOString()
    })
}

