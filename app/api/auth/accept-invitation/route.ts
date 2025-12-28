import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
    try {
        const { token, name, password } = await req.json()

        if (!token || !name || !password) {
            return NextResponse.json({
                message: "Token, name, and password are required"
            }, { status: 400 })
        }

        // Validate password strength
        if (password.length < 8) {
            return NextResponse.json({
                message: "Password must be at least 8 characters long"
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
