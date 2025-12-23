import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import nodemailer from "nodemailer"
import crypto from "crypto"

export async function POST(req: Request) {
    try {
        const { email } = await req.json()

        const user = await prisma.user.findUnique({
            where: { email },
        })

        if (!user) {
            // Return success even if user not found to prevent enumeration
            return NextResponse.json({ message: "If an account exists, a reset email has been sent." })
        }

        const resetToken = crypto.randomBytes(32).toString("hex")
        const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hour

        await prisma.user.update({
            where: { email },
            data: {
                resetToken,
                resetTokenExpiry,
            },
        })

        const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASS,
            },
        })

        console.log("Attempting to send email to:", email)
        console.log("Using Gmail User:", process.env.GMAIL_USER)

        await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: email,
            subject: "Reset your password",
            html: `<p>Click <a href="${resetUrl}">here</a> to reset your password.</p>`,
        })

        console.log("Email sent successfully")

        return NextResponse.json({ message: "If an account exists, a reset email has been sent." })
    } catch (error) {
        console.error("Forgot Password Error:", error)
        return NextResponse.json({ message: "Something went wrong" }, { status: 500 })
    }
}
