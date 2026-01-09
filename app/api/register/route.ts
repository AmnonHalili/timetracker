import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"
import { NextResponse } from "next/server"
import { Role } from "@prisma/client"
import { createNotification } from "@/lib/create-notification"
import { validatePassword } from "@/lib/password-validation"

import { validateEmail } from "@/lib/email-validation"

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const email = body.email?.toLowerCase()
        const { password, name, role, projectName } = body

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

                // Check if they need a project (for legacy pending users)
                let newProjectId = existingUser.projectId
                let newRole = existingUser.role

                if (!existingUser.projectId && !projectName /* Only if not joining a specific new team via join */) {
                    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase()
                    const project = await prisma.project.create({
                        data: {
                            name: `${name || existingUser.name}'s Workspace`,
                            joinCode
                        }
                    })
                    newProjectId = project.id
                    newRole = "ADMIN"

                    // Add membership
                    await prisma.projectMember.create({
                        data: {
                            userId: existingUser.id,
                            projectId: project.id,
                            role: "ADMIN",
                            status: "ACTIVE"
                        }
                    })
                }

                const updatedUser = await prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        name: name || existingUser.name, // Update name if provided, else keep existing
                        password: hashedPassword,
                        status: "ACTIVE",
                        projectId: newProjectId,
                        role: newRole
                        // Keep other fields
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

        // Transaction to ensure User, Project, and Memberships are created atomically
        const { user, pendingProjectId } = await prisma.$transaction(async (tx) => {
            let activeProjectId: string | null = null
            const activeRole: Role = "ADMIN" // Default to ADMIN (Owner of the created project)
            let pendingProjectId: string | null = null
            let userJobTitle: string | undefined = undefined

            // Scenario A: User creating a specific Team (ADMIN flow)
            if (role === "ADMIN") {
                if (!projectName) {
                    throw new Error("Project Name is required")
                }
                userJobTitle = "Company Owner"

                const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase()
                const project = await tx.project.create({
                    data: {
                        name: projectName,
                        joinCode: joinCode
                    }
                })
                activeProjectId = project.id
            }
            // Scenario B: User is a Member (Solo or Joining) -> Create Personal Workspace
            else {
                userJobTitle = !projectName ? "Freelancer" : "Team Member"

                // Always create a Personal Workspace
                const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase()
                const personalProject = await tx.project.create({
                    data: {
                        name: `${name}'s Workspace`,
                        joinCode: joinCode
                    }
                })
                activeProjectId = personalProject.id

                // If they have a Join Code, validate it and set pending
                if (projectName) {
                    const projectToJoin = await tx.project.findUnique({
                        where: {
                            joinCode: projectName.toUpperCase()
                        }
                    })

                    if (projectToJoin) {
                        pendingProjectId = projectToJoin.id
                    } else {
                        throw new Error("Invalid Team Code")
                    }
                }
            }

            // Create the User
            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    role: activeRole,
                    status: "ACTIVE", // Always active as they own their current workspace
                    projectId: activeProjectId,
                    pendingProjectId: pendingProjectId ?? undefined,
                    jobTitle: userJobTitle,
                }
            })

            // Create Active Membership for the Current Project (Personal or Team)
            if (activeProjectId) {
                await tx.projectMember.create({
                    data: {
                        userId: user.id,
                        projectId: activeProjectId,
                        role: "ADMIN",
                        status: "ACTIVE"
                    }
                })
            }

            // Create Pending Membership if joining another team
            if (pendingProjectId) {
                await tx.projectMember.create({
                    data: {
                        userId: user.id,
                        projectId: pendingProjectId,
                        role: "EMPLOYEE",
                        status: "PENDING"
                    }
                })
            }

            return { user, pendingProjectId }
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
