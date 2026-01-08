import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"
import { NextResponse } from "next/server"
import { validatePassword } from "@/lib/password-validation"

export async function POST(req: Request) {
    try {
        const { token, name, password } = await req.json()

        if (!token || !name || !password) {
            return NextResponse.json({
                message: "Token, name, and password are required"
            }, { status: 400 })
        }

        // Validate password strength
        const validation = validatePassword(password)
        if (!validation.isValid) {
            return NextResponse.json({
                message: validation.message
            }, { status: 400 })
        }

        // Find user with this invitation token
        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                status: "PENDING"
            }
        })

        if (!user) {
            return NextResponse.json({
                message: "Invalid invitation link"
            }, { status: 404 })
        }

        // Check if token expired
        if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
            return NextResponse.json({
                message: "Invitation link has expired. Please contact your administrator for a new invitation."
            }, { status: 400 })
        }

        // Check user limit before activating account
        if (user.projectId) {
            const activeUserCount = await prisma.user.count({
                where: {
                    projectId: user.projectId,
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

            // If activating this user would exceed current plan limit, return error
            if (requiredTier) {
                return NextResponse.json({
                    message: "User limit exceeded. Please contact your administrator to upgrade the plan before activating your account.",
                    error: "USER_LIMIT_EXCEEDED",
                    requiredTier,
                    currentUserCount: activeUserCount,
                    limit: activeUserCount < 20 ? 20 : activeUserCount < 50 ? 50 : null
                }, { status: 402 }) // 402 Payment Required
            }
        }

        // Hash password
        const hashedPassword = await hash(password, 10)

        // Update user: set name, password, activate account, clear token
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                name,
                password: hashedPassword,
                status: "ACTIVE",
                resetToken: null,
                resetTokenExpiry: null
            }
        })

        // Also activate the project membership record
        if (user.projectId) {
            await prisma.projectMember.update({
                where: {
                    userId_projectId: {
                        userId: user.id,
                        projectId: user.projectId
                    }
                },
                data: {
                    status: "ACTIVE"
                }
            }).catch(err => {
                console.error("[ACCEPT_INVITATION] Failed to update project member status:", err)
                // We don't block the whole process if this fails, but it shouldn't
            })
        }

        // Auto-promote manager if this user has direct reports
        if (user.managerId) {
            const manager = await prisma.user.findUnique({
                where: { id: user.managerId }
            })
            if (manager && manager.role === "EMPLOYEE") {
                await prisma.user.update({
                    where: { id: user.managerId },
                    data: { role: "MANAGER" }
                })
            }
        }

        return NextResponse.json({
            success: true,
            message: "Account activated successfully! You can now log in.",
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name
            }
        })
    } catch (error) {
        console.error("[ACCEPT_INVITATION_ERROR]", error)
        return NextResponse.json({
            message: "Failed to activate account. Please try again."
        }, { status: 500 })
    }
}
