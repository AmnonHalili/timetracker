import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { projectId: true }
        })

        if (!currentUser?.projectId) {
            return NextResponse.json({ message: "No project found" }, { status: 404 })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const requests = await prisma.user.findMany({
            where: {
                pendingProjectId: currentUser.projectId
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true
            }
        })

        return NextResponse.json(requests)
    } catch (error) {
        console.error("Failed to fetch requests:", error)
        return NextResponse.json({ message: "Internal Error" }, { status: 500 })
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const { userId, action } = await req.json()
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { projectId: true }
        })

        if (!currentUser?.projectId) {
            return NextResponse.json({ message: "No project found" }, { status: 404 })
        }

        // Verify the user is actually requesting THIS project
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            select: { pendingProjectId: true } as any
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any

        if (!targetUser || targetUser.pendingProjectId !== currentUser.projectId) {
            return NextResponse.json({ message: "Invalid request" }, { status: 400 })
        }

        if (action === "APPROVE") {
            // Check user limit before approving join request
            const activeUserCount = await prisma.user.count({
                where: {
                    projectId: currentUser.projectId,
                    status: "ACTIVE"
                }
            })

            // Get current user's plan
            const currentUserPlan = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { plan: true }
            })

            // Determine required tier based on current user count
            // Free: up to 3 users (0-3)
            // Team (Tier 1): 4-20 users
            // Business (Tier 2): 20-50 users
            // Company (Tier 3): 51+ users
            let requiredTier: string | null = null
            
            if (activeUserCount >= 3) {
                // Already at free limit (3 users), need Team for 4th user
                if (activeUserCount < 20) {
                    requiredTier = "tier1"
                } else if (activeUserCount < 50) {
                    requiredTier = "tier2"
                } else {
                    requiredTier = "tier3"
                }
            }

            // Check if current plan allows this user count
            const planLimit = currentUserPlan?.plan === 'FREE' ? 3 :
                             currentUserPlan?.plan === 'TIER1' ? 20 :
                             currentUserPlan?.plan === 'TIER2' ? 50 :
                             Infinity

            // If approving this request would exceed current plan limit, return error
            if (requiredTier && activeUserCount >= planLimit) {
                return NextResponse.json({
                    message: "User limit exceeded. Please upgrade your plan to approve this join request.",
                    error: "USER_LIMIT_EXCEEDED",
                    requiredTier,
                    currentUserCount: activeUserCount,
                    limit: activeUserCount < 20 ? 20 : activeUserCount < 50 ? 50 : null
                }, { status: 402 }) // 402 Payment Required
            }
            await prisma.user.update({
                where: { id: userId },
                data: {
                    pendingProjectId: null,
                    projectId: currentUser.projectId,
                    status: "ACTIVE", // Ensure active
                    managerId: session.user.id // Assign to approving admin as default manager
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any
            })
        } else if (action === "REJECT") {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    pendingProjectId: null
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any
            })
        } else {
            return NextResponse.json({ message: "Invalid action" }, { status: 400 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to process request:", error)
        return NextResponse.json({ message: "Internal Error" }, { status: 500 })
    }
}
