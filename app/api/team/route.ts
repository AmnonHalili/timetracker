import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
        }

        // Fetch user with role and direct reports count to determine permissions
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                projectId: true,
                role: true,
                _count: {
                    select: { directReports: true }
                }
            }
        })

        if (!currentUser?.projectId) {
            return NextResponse.json({ message: "Project not found" }, { status: 404 })
        }

        // Determine if user can see others
        // Admin/Manager or anyone with direct reports (subordinates)
        const canManageOthers =
            currentUser.role === 'ADMIN' ||
            currentUser.role === 'MANAGER' ||
            (currentUser._count?.directReports ?? 0) > 0

        // Build query
        const whereClause: Prisma.UserWhereInput = {
            projectId: currentUser.projectId,
            // If they can't manage others, they can only see themselves
            ...(canManageOthers ? {} : { id: session.user.id })
            // Note: we removed status: "ACTIVE" constraint or implied it. 
            // The previous code had `status: "ACTIVE"`. Let's keep it if they are managing, 
            // but for themselves, they are presumably active.
            // Actually, let's keep status active for consistency.
        }

        if (canManageOthers) {
            whereClause.status = "ACTIVE"
        }

        // Fetch users
        const users = await prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true,
                jobTitle: true,
                managerId: true
            },
            orderBy: {
                name: 'asc'
            }
        })

        return NextResponse.json(users)
    } catch (error) {
        console.error("[TEAM_GET_ERROR]", error)
        return NextResponse.json({ message: "Internal server error" }, { status: 500 })
    }
}
