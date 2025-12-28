import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const token = searchParams.get("token")

        if (!token) {
            return NextResponse.json({
                valid: false,
                message: "Token is required"
            }, { status: 400 })
        }

        // Find user with this invitation token
        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                status: "PENDING"
            },
            select: {
                id: true,
                email: true,
                resetTokenExpiry: true,
                project: {
                    select: {
                        name: true
                    }
                },
                role: true,
                jobTitle: true
            }
        })

        if (!user) {
            return NextResponse.json({
                valid: false,
                message: "Invalid invitation link"
            }, { status: 404 })
        }

        // Check if token expired
        if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
            return NextResponse.json({
                valid: false,
                message: "Invitation link has expired. Please request a new one."
            }, { status: 400 })
        }

        return NextResponse.json({
            valid: true,
            email: user.email,
            projectName: user.project?.name || "the team",
            role: user.role,
            jobTitle: user.jobTitle
        })
    } catch (error) {
        console.error("[VALIDATE_INVITATION_ERROR]", error)
        return NextResponse.json({
            valid: false,
            message: "Failed to validate invitation"
        }, { status: 500 })
    }
}
