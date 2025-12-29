import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function GET(
    req: Request,
    { params }: { params: { taskId: string } }
) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const { taskId } = params

        // Verify task exists and user has permission
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                assignees: { select: { id: true } }
            }
        })

        if (!task) {
            return NextResponse.json({ message: "Task not found" }, { status: 404 })
        }

        // Permission check: user must be assignee of task or admin
        const hasPermission = session.user.role === "ADMIN" || 
            task.assignees.some(u => u.id === session.user.id)

        if (!hasPermission) {
            return NextResponse.json({ message: "You don't have permission to view this task" }, { status: 403 })
        }

        // Fetch all time entries for this task
        const timeEntries = await prisma.timeEntry.findMany({
            where: {
                tasks: {
                    some: {
                        id: taskId
                    }
                }
            },
            select: {
                id: true,
                userId: true,
                startTime: true,
                endTime: true,
                description: true,
                isManual: true,
                createdAt: true,
                updatedAt: true,
                subtaskId: true,
                locationRequired: true,
                startLocationLat: true,
                startLocationLng: true,
                startLocationVerified: true,
                endLocationLat: true,
                endLocationLng: true,
                endLocationVerified: true,
                locationStatus: true,
                user: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: {
                startTime: 'desc'
            }
        })

        return NextResponse.json(timeEntries)
    } catch (error) {
        console.error("Error fetching task time entries:", error)
        return NextResponse.json({ message: "Error fetching time entries" }, { status: 500 })
    }
}

