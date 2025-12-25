import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getReportData } from "@/lib/report-service"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"
import { startOfMonth, endOfMonth } from "date-fns"
import { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const month = parseInt(searchParams.get("month") || "")
        const year = parseInt(searchParams.get("year") || "")

        if (isNaN(month) || isNaN(year)) {
            return NextResponse.json({ error: "Invalid date params" }, { status: 400 })
        }

        const currentDate = new Date(year, month, 1)
        const monthStart = startOfMonth(currentDate)
        const monthEnd = endOfMonth(currentDate)

        // 1. Reports
        const reportData = await getReportData(session.user.id, year, month)

        // 2. Fetch User & determine scope
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, projectId: true }
        })

        // 3. Tasks
        const taskWhereClause: any = {
            deadline: {
                gte: monthStart,
                lte: monthEnd
            }
        }

        if (currentUser?.role === "ADMIN" && currentUser?.projectId) {
            taskWhereClause.assignees = {
                some: {
                    projectId: currentUser.projectId
                }
            }
        } else {
            taskWhereClause.assignees = {
                some: {
                    id: session.user.id
                }
            }
        }

        const tasks = await (prisma as any).task.findMany({
            where: taskWhereClause,
            select: {
                id: true,
                title: true,
                deadline: true,
                priority: true,
                status: true,
                description: true,
                assignees: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            }
        })

        // 4. Events
        const eventWhereClause: any = {
            startTime: { gte: monthStart },
            endTime: { lte: monthEnd },
            participants: { some: { userId: session.user.id } }
        }

        if (currentUser?.projectId) {
            eventWhereClause.projectId = currentUser.projectId
        }

        const events = await (prisma as any).event.findMany({
            where: eventWhereClause,
            select: {
                id: true,
                title: true,
                description: true,
                startTime: true,
                endTime: true,
                allDay: true,
                type: true,
                location: true,
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                startTime: 'asc'
            }
        })

        return NextResponse.json({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dailyReports: (reportData as any)?.report?.days || [],
            tasks,
            events
        })
    } catch (error) {
        console.error("Error fetching calendar data:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
