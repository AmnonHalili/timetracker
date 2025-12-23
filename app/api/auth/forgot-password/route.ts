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

        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false, // Use `true` for port 465, `false` for all other ports
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASS,
            },
        })

        console.log("----------------------------------------")
        console.log("Forgot Password Request Received")
        console.log("Email:", email)
        console.log("SMTP Config - User:", process.env.GMAIL_USER ? "Defined" : "Undefined")
        console.log("SMTP Config - Pass:", process.env.GMAIL_PASS ? "Defined" : "Undefined")
        console.log("----------------------------------------")

        try {
            await transporter.verify()
            console.log("SMTP Connection Verified")
        } catch (verifyError) {
            console.error("SMTP Verify Error:", verifyError)
            return NextResponse.json({ message: "Failed to connect to email server" }, { status: 500 })
        }

        // Create the reset URL
        const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`

        // Logo URL - assumes NEXTAUTH_URL points to the live site
        const logoUrl = `${process.env.NEXTAUTH_URL}/logo.png`

        // Professional HTML Email Template
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; margin-top: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
                .header { background-color: #18181b; padding: 24px; text-align: center; }
                .header img { height: 40px; width: auto; }
                .header h1 { color: #ffffff; margin: 10px 0 0; font-size: 24px; font-weight: 600; }
                .content { padding: 40px 32px; color: #3f3f46; line-height: 1.6; }
                .content h2 { margin-top: 0; color: #18181b; font-size: 20px; }
                .button { display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 24px; margin-bottom: 24px; }
                .button:hover { background-color: #1d4ed8; }
                .footer { background-color: #f4f4f5; padding: 24px; text-align: center; font-size: 12px; color: #71717a; }
                .footer a { color: #71717a; text-decoration: underline; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <img src="${logoUrl}" alt="Collabo" />
                    <!-- Fallback title -->
                    <div style="color: white; font-size: 24px; font-weight: bold; margin-top: 10px;">Collabo</div>
                </div>
                <div class="content">
                    <h2>Password Reset Request</h2>
                    <p>Hello,</p>
                    <p>We received a request to reset the password for your Collabo account associated with this email address.</p>
                    <div style="text-align: center;">
                        <a href="${resetUrl}" class="button" style="color: #ffffff;">Reset Password</a>
                    </div>
                    <p>If you didn't request this, you can safely ignore this email. Your password will remain unchanged.</p>
                    <p>This link will expire in 1 hour for security reasons.</p>
                    <p>Best regards,<br>The Collabo Team</p>
                </div>
                <div class="footer">
                    <p>&copy; ${new Date().getFullYear()} Collabo. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `

        await transporter.sendMail({
            from: `"Collabo Support" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: "Reset your Collabo password",
            html: htmlContent,
        })

        console.log("Email sent successfully")

        return NextResponse.json({ message: "If an account exists, a reset email has been sent." })
    } catch (error) {
        console.error("Forgot Password Error:", error)
        return NextResponse.json({ message: "Something went wrong" }, { status: 500 })
    }
}
