import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const { name, email, password, role, managerId, jobTitle, chiefType } = await req.json()

        if (!name || !email) {
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
        }

        // Only ADMIN can create ADMINs
        if (role === "ADMIN" && session.user.role !== "ADMIN") {
            return NextResponse.json({ message: "Only Admins can create other Admins" }, { status: 403 })
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                projectId: true,
                id: true
            }
        })

        if (!currentUser?.projectId) {
            return NextResponse.json({ message: "Project not found" }, { status: 404 })
        }

        // Check user limit before adding new user
        const activeUserCount = await prisma.user.count({
            where: {
                projectId: currentUser.projectId,
                status: "ACTIVE"
            }
        })

        // Determine required tier based on current user count
        // Free: up to 5 users (0-5)
        // Tier 1: 6-20 users
        // Tier 2: 21-50 users
        // Tier 3: 50+ users
        let requiredTier: string | null = null
        
        if (activeUserCount >= 5) {
            // Already at free limit (5 users), need Tier 1 for 6th user
            if (activeUserCount < 20) {
                requiredTier = "tier1"
            } else if (activeUserCount < 50) {
                requiredTier = "tier2"
            } else {
                requiredTier = "tier3"
            }
        }

        // If user would exceed current plan limit, return error
        if (requiredTier) {
            return NextResponse.json({
                message: "User limit exceeded. Please upgrade your plan to add more team members.",
                error: "USER_LIMIT_EXCEEDED",
                requiredTier,
                currentUserCount: activeUserCount,
                limit: activeUserCount < 20 ? 20 : activeUserCount < 50 ? 50 : null
            }, { status: 402 }) // 402 Payment Required
        }

        // Check if email exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        })

        if (existingUser) {
            return NextResponse.json({ message: "Email already exists" }, { status: 400 })
        }

        // Generate random password if not provided (for invited members)
        const passwordToHash = password || Math.random().toString(36).slice(-8)
        const hashedPassword = await bcrypt.hash(passwordToHash, 10)

        // Validate managerId if provided
        if (managerId) {
            const manager = await prisma.user.findUnique({
                where: { id: managerId, projectId: currentUser.projectId }
            })
            if (!manager) {
                return NextResponse.json({ message: "Manager not found in this project" }, { status: 400 })
            }
        }

        // Handle Chief creation logic
        let sharedChiefGroupId: string | null = null
        let finalManagerId: string | null = managerId || null

        if (role === "ADMIN" && chiefType) {
            if (chiefType === "partner") {
                // Partner (Shared Chief) logic
                // Check if current user is already a top-level chief (no manager)
                let currentUserFull: { managerId: string | null; sharedChiefGroupId?: string | null } | null
                try {
                    // Try to fetch with sharedChiefGroupId
                    currentUserFull = (await prisma.user.findUnique({
                        where: { id: currentUser.id },
                        select: { managerId: true, sharedChiefGroupId: true } as never
                    })) as { managerId: string | null; sharedChiefGroupId?: string | null } | null
                } catch (fieldError: unknown) {
                    // If field doesn't exist, fetch without it
                    const error = fieldError as { message?: string }
                    if (error.message?.includes('sharedChiefGroupId') || error.message?.includes('Unknown field')) {
                        currentUserFull = await prisma.user.findUnique({
                            where: { id: currentUser.id },
                            select: { managerId: true }
                        })
                        // Set to null if field doesn't exist
                        currentUserFull = currentUserFull ? { ...currentUserFull, sharedChiefGroupId: null } : null
                    } else {
                        throw fieldError
                    }
                }

                if (currentUserFull?.managerId) {
                    return NextResponse.json({
                        message: "Only top-level chiefs can add partners. You must be a root-level chief."
                    }, { status: 400 })
                }

                // Use existing sharedChiefGroupId or create a new one
                if (currentUserFull?.sharedChiefGroupId) {
                    sharedChiefGroupId = currentUserFull.sharedChiefGroupId
                } else {
                    // Create new shared group ID (using cuid-like format)
                    sharedChiefGroupId = `shared-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

                    // Update current user to have this shared group ID
                    try {
                        await prisma.user.update({
                            where: { id: currentUser.id },
                            data: { sharedChiefGroupId } as Record<string, unknown>
                        })
                    } catch (updateError: unknown) {
                        // If field doesn't exist in Prisma client, log warning but continue
                        const error = updateError as { message?: string }
                        if (error.message?.includes('sharedChiefGroupId') || error.message?.includes('Unknown field')) {
                            console.warn("sharedChiefGroupId field not available in Prisma client, skipping update")
                            // Set to null so we don't try to use it
                            sharedChiefGroupId = null
                        } else {
                            throw updateError
                        }
                    }
                }

                // New chief will have no manager (top-level) but same sharedChiefGroupId
                finalManagerId = null

                // After creating the new chief, assign all employees under current chief to also report to new chief
                // We'll do this after user creation
            } else if (chiefType === "independent") {
                // Independent Chief - no manager, no shared group
                finalManagerId = null
                sharedChiefGroupId = null
            }
        }

        // Prepare user data
        const userData = {
            name,
            email,
            password: hashedPassword,
            role: role || "EMPLOYEE",
            jobTitle: jobTitle || null,
            projectId: currentUser.projectId,
            managerId: finalManagerId,
            status: password ? "ACTIVE" : "PENDING", // PENDING if no password provided (invited)
            dailyTarget: 9.0,
            sharedChiefGroupId: sharedChiefGroupId || undefined,
        }

        const newUser = await prisma.user.create({
            data: userData as never
        })

        // If adding as partner, assign all employees under current chief to also report to new chief
        if (role === "ADMIN" && chiefType === "partner" && sharedChiefGroupId) {
            // Note: For shared chiefs, employees report to the "primary" chief (the one who was there first)
            // Both chiefs can see and manage all employees in the shared group
            // The permission checks will need to account for sharedChiefGroupId
            // For now, we'll leave employees reporting to the original chief
            // Permission checks will be updated to allow both chiefs to manage employees in their shared group
        }

        // Auto-promote manager to MANAGER if they are currently EMPLOYEE
        if (finalManagerId) {
            const manager = await prisma.user.findUnique({ where: { id: finalManagerId } })
            if (manager && manager.role === "EMPLOYEE") {
                await prisma.user.update({
                    where: { id: finalManagerId },
                    data: { role: "MANAGER" }
                })
            }
        }

        return NextResponse.json({ user: newUser })
    } catch (error) {
        console.error("[CREATE_MEMBER_ERROR]", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        // Log full error for debugging
        if (error instanceof Error) {
            console.error("[CREATE_MEMBER_ERROR] Stack:", error.stack)
        }
        return NextResponse.json({
            message: "Failed to create member",
            error: errorMessage
        }, { status: 500 })
    }
}
