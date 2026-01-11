import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createNotification } from "@/lib/create-notification"

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

        // Find users with pendingProjectId OR users with PENDING ProjectMember status
        // This handles both cases:
        // 1. Users who registered with join code (pendingProjectId set)
        // 2. Users who already have a projectId but want to join another project (ProjectMember PENDING)
        const requestsByPendingId = await prisma.user.findMany({
            where: {
                pendingProjectId: currentUser.projectId
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
                image: true
            }
        })

        // Also find users with PENDING ProjectMember status for this project
        const pendingMembers = await prisma.projectMember.findMany({
            where: {
                projectId: currentUser.projectId,
                status: "PENDING"
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        createdAt: true,
                        image: true
                    }
                }
            }
        })

        // Combine both sources and remove duplicates
        const requestIds = new Set(requestsByPendingId.map(r => r.id))
        const additionalRequests = pendingMembers
            .filter(pm => !requestIds.has(pm.userId))
            .map(pm => ({
                id: pm.user.id,
                name: pm.user.name,
                email: pm.user.email,
                createdAt: pm.user.createdAt,
                image: pm.user.image
            }))

        const requests = [...requestsByPendingId, ...additionalRequests]

        // Add cache headers to prevent stale data
        return NextResponse.json(requests, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        })
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
        const { userId, action, managerId, role, jobTitle, chiefType } = await req.json()
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { projectId: true, managerId: true }
        })

        if (!currentUser?.projectId) {
            return NextResponse.json({ message: "No project found" }, { status: 404 })
        }

        // Verify the user is actually requesting THIS project
        // Check both pendingProjectId and ProjectMember status
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            select: { pendingProjectId: true } as any
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any

        // Check if user has pendingProjectId for this project
        const hasPendingProjectId = targetUser?.pendingProjectId === currentUser.projectId

        // Also check if user has PENDING ProjectMember for this project
        const pendingMember = await prisma.projectMember.findUnique({
            where: {
                userId_projectId: {
                    userId: userId,
                    projectId: currentUser.projectId
                }
            },
            select: {
                status: true
            }
        })

        const hasPendingMembership = pendingMember?.status === "PENDING"

        // User must have either pendingProjectId OR PENDING ProjectMember for this project
        if (!targetUser || (!hasPendingProjectId && !hasPendingMembership)) {
            return NextResponse.json({ message: "Invalid request" }, { status: 400 })
        }

        if (action === "APPROVE") {
            // Determine the role (default to EMPLOYEE if not provided)
            const userRole = role || "EMPLOYEE"

            // Validate based on role
            if (userRole === "EMPLOYEE") {
                // Require managerId for EMPLOYEE
                if (!managerId) {
                    return NextResponse.json({ message: "Manager ID is required for approval. Please select a 'Reports To' manager." }, { status: 400 })
                }

                // Validate managerId exists and belongs to the same project
                const manager = await prisma.user.findUnique({
                    where: { id: managerId },
                    select: { id: true, projectId: true, role: true }
                })

                if (!manager) {
                    return NextResponse.json({ message: "Manager not found" }, { status: 404 })
                }

                if (manager.projectId !== currentUser.projectId) {
                    return NextResponse.json({ message: "Manager does not belong to this project" }, { status: 400 })
                }

                // Prevent self-assignment
                if (userId === managerId) {
                    return NextResponse.json({ message: "Cannot assign user to report to themselves" }, { status: 400 })
                }

                // Circular dependency check
                let current = await prisma.user.findUnique({ where: { id: managerId } })
                const visited = new Set<string>()
                while (current?.managerId) {
                    if (current.managerId === userId) {
                        return NextResponse.json({ message: "Circular reference detected. This assignment would create a circular dependency in the hierarchy." }, { status: 400 })
                    }
                    if (visited.has(current.id)) {
                        break // Prevent infinite loop
                    }
                    visited.add(current.id)
                    current = await prisma.user.findUnique({ where: { id: current.managerId } })
                }
            } else if (userRole === "ADMIN") {
                // Require chiefType for ADMIN
                if (!chiefType || !["partner", "independent"].includes(chiefType)) {
                    return NextResponse.json({ message: "Chief type is required for approval. Please select 'Partner' or 'Independent'." }, { status: 400 })
                }
            }
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
            // Team (Tier 1): 4-10 users
            // Business (Tier 2): 10-20 users
            // Company (Tier 3): 20+ users
            let requiredTier: string | null = null

            if (activeUserCount >= 3) {
                // Already at free limit (3 users), need Team for 4th user
                if (activeUserCount < 10) {
                    requiredTier = "tier1"
                } else if (activeUserCount < 20) {
                    requiredTier = "tier2"
                } else {
                    requiredTier = "tier3"
                }
            }

            // Check if current plan allows this user count
            const planLimit = currentUserPlan?.plan === 'FREE' ? 3 :
                currentUserPlan?.plan === 'TIER1' ? 10 :
                    currentUserPlan?.plan === 'TIER2' ? 20 :
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

            // Handle Chief creation logic
            let sharedChiefGroupId: string | null = null
            let finalManagerId: string | null = null

            if (userRole === "ADMIN" && chiefType) {
                if (chiefType === "partner") {
                    // Partner (Shared Chief) logic
                    // Check if current user is top-level (no managerId)
                    if (currentUser.managerId) {
                        return NextResponse.json({
                            message: "Only top-level chiefs can add partners. You must be a root-level chief."
                        }, { status: 400 })
                    }

                    // Get current user's sharedChiefGroupId
                    let currentUserFull: { managerId: string | null; sharedChiefGroupId?: string | null } | null
                    try {
                        currentUserFull = (await prisma.user.findUnique({
                            where: { id: session.user.id },
                            select: { managerId: true, sharedChiefGroupId: true } as never
                        })) as { managerId: string | null; sharedChiefGroupId?: string | null } | null
                    } catch {
                        currentUserFull = await prisma.user.findUnique({
                            where: { id: session.user.id },
                            select: { managerId: true }
                        })
                        currentUserFull = currentUserFull ? { ...currentUserFull, sharedChiefGroupId: null } : null
                    }

                    // Use existing sharedChiefGroupId or create a new one
                    if (currentUserFull?.sharedChiefGroupId) {
                        sharedChiefGroupId = currentUserFull.sharedChiefGroupId
                    } else {
                        // Create a new shared group ID
                        sharedChiefGroupId = `shared-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
                        // Also update current user to have this shared group ID
                        try {
                            await prisma.user.update({
                                where: { id: session.user.id },
                                data: { sharedChiefGroupId } as Record<string, unknown>
                            })
                        } catch (updateError: unknown) {
                            const error = updateError as { message?: string }
                            if (error.message?.includes('sharedChiefGroupId') || error.message?.includes('Unknown field')) {
                                console.warn("sharedChiefGroupId field not available in Prisma client, skipping update")
                                sharedChiefGroupId = null
                            } else {
                                throw updateError
                            }
                        }
                    }

                    // New chief will have no manager (top-level) but same sharedChiefGroupId
                    finalManagerId = null
                } else if (chiefType === "independent") {
                    // Independent Chief - no manager, no shared group
                    finalManagerId = null
                    sharedChiefGroupId = null
                }
            } else if (userRole === "EMPLOYEE") {
                // EMPLOYEE role - use provided managerId
                finalManagerId = managerId
            }

            // Prepare update data
            const updateData: Record<string, unknown> = {
                pendingProjectId: null,
                projectId: currentUser.projectId,
                status: "ACTIVE",
                role: userRole,
                managerId: finalManagerId,
                jobTitle: jobTitle || null
            }

            // Add sharedChiefGroupId if applicable
            if (userRole === "ADMIN" && sharedChiefGroupId) {
                updateData.sharedChiefGroupId = sharedChiefGroupId
            } else if (userRole === "ADMIN") {
                updateData.sharedChiefGroupId = null
            }

            // Update user with approval and assigned fields
            await prisma.user.update({
                where: { id: userId },
                data: updateData as never
            })

            // Update ProjectMember status from PENDING to ACTIVE if it exists
            await prisma.projectMember.updateMany({
                where: {
                    userId: userId,
                    projectId: currentUser.projectId,
                    status: "PENDING"
                },
                data: {
                    status: "ACTIVE",
                    role: userRole === "ADMIN" ? "ADMIN" : "EMPLOYEE"
                }
            })

            // Auto-promote manager to MANAGER if they are currently EMPLOYEE (only for EMPLOYEE role)
            if (userRole === "EMPLOYEE" && managerId) {
                const manager = await prisma.user.findUnique({
                    where: { id: managerId },
                    select: { role: true }
                })
                if (manager && manager.role === "EMPLOYEE") {
                    await prisma.user.update({
                        where: { id: managerId },
                        data: { role: "MANAGER" }
                    })
                }
            }

            // Revalidate team pages to show the new user
            revalidatePath("/team")
            revalidatePath("/team/hierarchy")
        } else if (action === "REJECT") {
            // Get project name for notification
            const project = await prisma.project.findUnique({
                where: { id: currentUser.projectId },
                select: { name: true }
            })

            await prisma.user.update({
                where: { id: userId },
                data: {
                    pendingProjectId: null
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any
            })

            // Also delete or update PENDING ProjectMember if it exists
            await prisma.projectMember.deleteMany({
                where: {
                    userId: userId,
                    projectId: currentUser.projectId,
                    status: "PENDING"
                }
            })

            // Notify the rejected user
            await createNotification({
                userId: userId,
                title: "Join Request Rejected",
                message: `Your request to join ${project?.name || "the project"} has been rejected.`,
                type: "WARNING",
                link: "/team"
            })

            // Revalidate team pages after rejection
            revalidatePath("/team")
        } else {
            return NextResponse.json({ message: "Invalid action" }, { status: 400 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to process request:", error)
        return NextResponse.json({ message: "Internal Error" }, { status: 500 })
    }
}
