import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import nodemailer from "nodemailer"
import crypto from "crypto"

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    console.log("[API] Invite Team Member - Debug logs:")
    console.log("[API] Session exists:", !!session)
    console.log("[API] User ID:", session?.user?.id)
    console.log("[API] User Role:", session?.user?.role)
    console.log("[API] User Email:", session?.user?.email)

    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
        console.log("[API] Authorization Failed. Reason:", !session ? "No Session" : `Invalid Role: ${session.user.role}`)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await req.json()
        const email = body.email ? body.email.toLowerCase() : ""
        const { role, managerId, jobTitle, chiefType } = body

        if (!email) {
            return NextResponse.json({ message: "Email is required" }, { status: 400 })
        }

        // Only ADMIN can invite ADMINs
        if (role === "ADMIN" && session.user.role !== "ADMIN") {
            return NextResponse.json({ message: "Only Admins can invite other Admins" }, { status: 403 })
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                projectId: true,
                id: true,
                name: true,
                plan: true, // Add plan selection
                project: {
                    select: {
                        name: true
                    }
                }
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
        // and check against the user's ACTUAL subscription plan
        const userPlan = currentUser.plan || 'FREE' // Default to free if null

        // New pricing model limits:
        // Free: up to 3 users
        // Team (TIER1): 4-20 users
        // Business (TIER2): 20-50 users
        // Company (TIER3): 51+ users
        let planLimit = 3
        if (userPlan === 'TIER1') planLimit = 20
        if (userPlan === 'TIER2') planLimit = 50
        if (userPlan === 'TIER3') planLimit = Infinity

        // Determine required tier if limit would be exceeded
        let requiredTier: string | null = null
        if (activeUserCount >= 3) {
            if (activeUserCount < 20) {
                requiredTier = "tier1"
            } else if (activeUserCount < 50) {
                requiredTier = "tier2"
            } else {
                requiredTier = "tier3"
            }
        }

        // If user would exceed current plan limit, return error
        if (activeUserCount >= planLimit && requiredTier) {
            return NextResponse.json({
                message: "User limit exceeded. Please upgrade your plan to add more team members.",
                error: "USER_LIMIT_EXCEEDED",
                requiredTier,
                currentPlan: userPlan,
                currentUserCount: activeUserCount,
                limit: activeUserCount < 20 ? 20 : activeUserCount < 50 ? 50 : null
            }, { status: 402 }) // 402 Payment Required
        }

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        })

        if (existingUser && existingUser.status === "ACTIVE") {
            return NextResponse.json({ message: "User with this email already exists" }, { status: 400 })
        }

        // If user exists but is PENDING, we can resend invitation
        if (existingUser && existingUser.status === "PENDING") {
            // Check if previous token expired
            if (existingUser.resetTokenExpiry && existingUser.resetTokenExpiry > new Date()) {
                return NextResponse.json({
                    message: "Invitation already sent to this email. Please wait for it to expire before resending."
                }, { status: 400 })
            }
            // Token expired, we can update and resend
        }

        // Validate managerId if provided
        if (managerId && managerId !== "unassigned") {
            const manager = await prisma.user.findUnique({
                where: { id: managerId, projectId: currentUser.projectId }
            })
            if (!manager) {
                return NextResponse.json({ message: "Manager not found in this project" }, { status: 400 })
            }
        }

        // Handle Chief creation logic for sharedChiefGroupId
        let sharedChiefGroupId: string | null = null
        let finalManagerId: string | null = managerId === "unassigned" || !managerId ? null : managerId

        if (role === "ADMIN" && chiefType) {
            if (chiefType === "partner") {
                // Partner (Shared Chief) logic
                let currentUserFull: { managerId: string | null; sharedChiefGroupId?: string | null } | null
                try {
                    currentUserFull = (await prisma.user.findUnique({
                        where: { id: currentUser.id },
                        select: { managerId: true, sharedChiefGroupId: true } as never
                    })) as { managerId: string | null; sharedChiefGroupId?: string | null } | null
                } catch {
                    currentUserFull = await prisma.user.findUnique({
                        where: { id: currentUser.id },
                        select: { managerId: true }
                    })
                    currentUserFull = currentUserFull ? { ...currentUserFull, sharedChiefGroupId: null } : null
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
                    sharedChiefGroupId = `shared-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

                    await prisma.user.update({
                        where: { id: currentUser.id },
                        data: { sharedChiefGroupId } as Record<string, unknown>
                    })
                }

                finalManagerId = null
            } else if (chiefType === "independent") {
                finalManagerId = null
                sharedChiefGroupId = null
            }
        }

        // Generate invitation token
        const invitationToken = crypto.randomBytes(32).toString("hex")
        const invitationTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours

        // Create or update user with PENDING status
        let invitedUser
        if (existingUser) {
            // Update existing PENDING user
            invitedUser = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    role: role || "EMPLOYEE",
                    jobTitle: jobTitle || null,
                    managerId: finalManagerId,
                    resetToken: invitationToken,
                    resetTokenExpiry: invitationTokenExpiry,
                    sharedChiefGroupId: sharedChiefGroupId || undefined,
                } as never
            })
        } else {
            // Create new user
            invitedUser = await prisma.user.create({
                data: {
                    email,
                    name: email.split('@')[0], // Temporary name, will be updated on acceptance
                    role: role || "EMPLOYEE",
                    jobTitle: jobTitle || null,
                    projectId: currentUser.projectId,
                    managerId: finalManagerId,
                    status: "PENDING",
                    resetToken: invitationToken,
                    resetTokenExpiry: invitationTokenExpiry,
                    sharedChiefGroupId: sharedChiefGroupId || undefined,
                } as never
            })
        }

        // Send invitation email
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASS,
            },
        })

        const invitationUrl = `${process.env.NEXTAUTH_URL}/accept-invitation?token=${invitationToken}`
        const logoUrl = `${process.env.NEXTAUTH_URL}/collabologo.png`
        const projectName = currentUser.project?.name || "the team"
        const inviterName = currentUser.name || "A team member"

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Join the team on Collabo</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; margin-top: 40px; margin-bottom: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
                .header { background-color: #ffffff; padding: 32px 24px; text-align: center; border-bottom: 1px solid #f4f4f5; }
                .header img { height: 48px; width: auto; }
                .content { padding: 48px 40px; color: #3f3f46; line-height: 1.6; text-align: center; }
                .content h1 { margin-top: 0; color: #18181b; font-size: 24px; font-weight: 700; letter-spacing: -0.025em; margin-bottom: 24px; }
                .content p { margin-bottom: 24px; color: #52525b; font-size: 16px; }
                .inviter-badge { background-color: #f4f4f5; border-radius: 9999px; padding: 8px 16px; font-size: 14px; color: #18181b; display: inline-block; margin-bottom: 24px; font-weight: 500; }
                .button { display: inline-block; background-color: #000000; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 8px; margin-bottom: 32px; transition: background-color 0.2s; }
                .button:hover { background-color: #27272a; }
                .link-text { font-size: 12px; color: #a1a1aa; word-break: break-all; margin-top: 24px; }
                .footer { background-color: #fafafa; padding: 24px; text-align: center; font-size: 12px; color: #a1a1aa; border-top: 1px solid #f4f4f5; }
                .footer a { color: #52525b; text-decoration: underline; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <img src="${logoUrl}" alt="Collabo" />
                </div>
                <div class="content">
                    <div class="inviter-badge">
                        👋 <strong>${inviterName}</strong> invited you
                    </div>
                    <h1>Join ${projectName} on Collabo</h1>
                    <p>You've been invited to join the team workspace. Accept the invitation to set up your account and get started.</p>
                    
                    <a href="${invitationUrl}" class="button" style="color: #ffffff;">
                        Accept Invitation
                    </a>

                    <p class="link-text">
                        Button not working? Copy and paste this link into your browser:<br>
                        ${invitationUrl}
                    </p>
                    
                    <p style="font-size: 13px; color: #71717a; margin-top: 32px;">
                        This invitation will expire in 48 hours.
                    </p>
                </div>
                <div class="footer">
                    <p>&copy; ${new Date().getFullYear()} Collabo. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `

        try {
            await transporter.verify()
            await transporter.sendMail({
                from: `"Collabo" <${process.env.GMAIL_USER}>`,
                to: email,
                subject: `You've been invited to join ${projectName}`,
                html: htmlContent,
            })
        } catch (emailError) {
            console.error("Failed to send invitation email:", emailError)
            return NextResponse.json({
                message: "User created but failed to send invitation email. Please try again."
            }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            message: `Invitation sent to ${email}`,
            user: { id: invitedUser.id, email: invitedUser.email }
        })
    } catch (error) {
        console.error("[INVITE_ERROR]", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        return NextResponse.json({
            message: "Failed to send invitation",
            error: errorMessage
        }, { status: 500 })
    }
}
