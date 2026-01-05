import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"
import { NextResponse } from "next/server"
import { Role, Status } from "@prisma/client"
import { createNotification } from "@/lib/create-notification"
import { validatePassword } from "@/lib/password-validation"

import { validateEmail } from "@/lib/email-validation"

export async function POST(req: Request) {
    try {
        const { email, password, name, role, projectName } = await req.json()

        if (!email || !password || !name) {
            return NextResponse.json(
                { message: "Missing required fields" },
                { status: 400 }
            )
        }

        const emailValidation = await validateEmail(email)
        if (!emailValidation.isValid) {
            return NextResponse.json(
                { message: emailValidation.message },
                { status: 400 }
            )
        }

        const validation = validatePassword(password)
        if (!validation.isValid) {
            return NextResponse.json(
                { message: validation.message },
                { status: 400 }
            )
        }

        // Check if email exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        })

        if (existingUser) {
            // If user exists and is PENDING, allow them to claim the account (set password and activate)
            if (existingUser.status === "PENDING") {
                const hashedPassword = await hash(password, 10)

                const updatedUser = await prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        name: name || existingUser.name, // Update name if provided, else keep existing
                        password: hashedPassword,
                        status: "ACTIVE",
                        // Keep their role, manager, project, etc. as set by Admin
                    }
                })

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const userWithoutPassword = { ...updatedUser } as any
                delete userWithoutPassword.password

                return NextResponse.json(userWithoutPassword, { status: 200 }) // 200 OK for updates
            } else {
                return NextResponse.json(
                    { message: "User already exists" },
                    { status: 400 }
                )
            }
        }

        const hashedPassword = await hash(password, 10)

        // If creating a team (ADMIN)
        let projectId = null
        let userRole = "MEMBER"
        const userStatus = "ACTIVE" // Default to ACTIVE for both (admins auto-active, members independent active)
        let pendingProjectId = null

        if (role === "ADMIN") {
            if (!projectName) {
                return NextResponse.json({ message: "Project Name is required" }, { status: 400 })
            }

            // Generate a random 6-character code
            const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase()

            const project = await prisma.project.create({
                data: {
                    name: projectName,
                    joinCode: joinCode
                }
            })
            projectId = project.id
            userRole = "ADMIN"
        } else {
            // Member Registration
            // If they provided a project name (now interpreted as Join Code) to join
            if (projectName) {
                // Find project by JOIN CODE
                const projectToJoin = await prisma.project.findUnique({
                    where: {
                        joinCode: projectName.toUpperCase()
                    }
                })

                if (projectToJoin) {
                    pendingProjectId = projectToJoin.id

                    // Create Notification for Project Admins
                    // We'll do this AFTER creating the user so we have the userId for reference if needed
                } else {
                    return NextResponse.json({ message: "Invalid Team Code" }, { status: 400 })
                }
            }
        }

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: userRole as Role,
                status: userStatus as Status,
                projectId,
                pendingProjectId: pendingProjectId ?? undefined,
                // Set default jobTitle: "Founder" for ADMIN users who create a team, "single" for members without a team
                jobTitle: role === "ADMIN" ? "Company Owner" : (!projectName ? "single" : undefined),
                // workDays and dailyTarget are now handled by DB defaults (or lack thereof)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
        })

        // Send Notification to Admins if pendingProjectId is set
        if (pendingProjectId) {
            const admins = await prisma.user.findMany({
                where: {
                    projectId: pendingProjectId,
                    role: "ADMIN"
                }
            })

            // Send real-time notifications to each admin
            await Promise.all(admins.map(admin =>
                createNotification({
                    userId: admin.id,
                    title: "New Join Request",
                    message: `${user.name} has requested to join your project.`,
                    type: "INFO",
                    link: "/team"
                })
            ))
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userWithoutPassword = { ...user } as any
        delete userWithoutPassword.password

        return NextResponse.json(userWithoutPassword, { status: 201 })
    } catch (error) {
        console.error("Registration error:", error)
        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        )
    }
}
