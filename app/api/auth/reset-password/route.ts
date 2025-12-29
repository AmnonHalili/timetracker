import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"
import { validatePassword } from "@/lib/password-validation"

export async function POST(req: Request) {
    try {
        const { token, newPassword } = await req.json()

        const validation = validatePassword(newPassword)
        if (!validation.isValid) {
            return NextResponse.json({ message: validation.message }, { status: 400 })
        }

        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpiry: {
                    gt: new Date(),
                },
            },
        })

        if (!user) {
            return NextResponse.json({ message: "Invalid or expired token" }, { status: 400 })
        }

        const hashedPassword = await hash(newPassword, 10)

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null,
            },
        })

        return NextResponse.json({ message: "Password reset successful" })
    } catch (error) {
        console.error(error)
        return NextResponse.json({ message: "Something went wrong" }, { status: 500 })
    }
}
