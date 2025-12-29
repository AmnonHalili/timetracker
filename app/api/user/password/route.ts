import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { compare, hash } from "bcryptjs"
import { validatePassword } from "@/lib/password-validation"

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const { currentPassword, newPassword } = await req.json()

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ message: "Missing fields" }, { status: 400 })
        }

        const validation = validatePassword(newPassword)
        if (!validation.isValid) {
            return NextResponse.json({ message: validation.message }, { status: 400 })
        }

        // Get user with password
        const user = await prisma.user.findUnique({
            where: { id: session.user.id }
        })

        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 })
        }

        // Verify current password
        if (!user.password) {
            return NextResponse.json({ message: "This account uses Google Sign-In. You cannot change password." }, { status: 400 })
        }

        const isValid = await compare(currentPassword, user.password)

        if (!isValid) {
            return NextResponse.json({ message: "Incorrect current password" }, { status: 400 })
        }

        // Hash new password
        const hashedPassword = await hash(newPassword, 10)

        await prisma.user.update({
            where: { id: session.user.id },
            data: { password: hashedPassword }
        })

        return NextResponse.json({ message: "Password changed successfully" })
    } catch (error) {
        console.error("[PASSWORD_UPDATE_ERROR]", error)
        return NextResponse.json({ message: "Failed to update password" }, { status: 500 })
    }
}
