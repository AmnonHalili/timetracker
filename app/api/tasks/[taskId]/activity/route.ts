import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function GET(
    req: Request,
    { params }: { params: { taskId: string } }
) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    try {
        const activities = await prisma.taskActivity.findMany({
            where: { taskId: params.taskId },
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        name: true,
                        image: true
                    }
                }
            }
        })

        return NextResponse.json(activities)
    } catch (error) {
        console.error("Error fetching activity log:", error)
        return NextResponse.json({ message: "Failed to fetch activity log" }, { status: 500 })
    }
}
