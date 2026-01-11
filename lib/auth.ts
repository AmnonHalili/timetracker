import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { compare } from "bcryptjs"

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    pages: {
        signIn: "/login",
        error: "/login",
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days - session persists even after browser close
    },
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
            authorization: {
                params: {
                    scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
                    prompt: "consent",
                    access_type: "offline",
                    response_type: "code"
                }
            },
            profile(profile) {
                return {
                    id: profile.sub,
                    name: profile.name,
                    email: profile.email?.toLowerCase(),
                    image: profile.picture,
                    role: "EMPLOYEE",
                    status: "PENDING",
                    plan: "FREE",
                }
            }
        }),
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Missing credentials")
                }

                const normalizedEmail = credentials.email.toLowerCase()

                const user = await prisma.user.findUnique({
                    where: { email: normalizedEmail },
                })

                if (!user) {
                    throw new Error("Invalid credentials")
                }

                if (!user.password) {
                    throw new Error("Please log in with Google")
                }

                const isPasswordValid = await compare(credentials.password, user.password)

                if (!isPasswordValid) {
                    throw new Error("Invalid credentials")
                }

                if (user.status !== "ACTIVE" && user.role !== "ADMIN") {
                    throw new Error("Account pending approval")
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    status: user.status,
                    plan: user.plan,
                    projectId: user.projectId,
                }
            },
        }),
    ],
    events: {
        async createUser({ user }) {
            try {
                const { cookies } = await import("next/headers")
                const cookieStore = cookies()
                const role = cookieStore.get("regist_role")?.value
                const projectInfo = cookieStore.get("regist_project")?.value

                if (role && (role === "ADMIN" || role === "EMPLOYEE")) {
                    const decodedProjectInfo = projectInfo ? decodeURIComponent(projectInfo) : undefined

                    // Prepare update data
                    const updateData: Record<string, unknown> = { role }
                    let activeProjectId: string | null = null
                    let memberRole: "ADMIN" | "EMPLOYEE" = "ADMIN"
                    let memberStatus: "ACTIVE" | "PENDING" = "ACTIVE"

                    // Handle Project Logic
                    if (role === "ADMIN") {
                        // Create a new project for the admin
                        const projectName = decodedProjectInfo || `${user.name}'s Workspace`
                        const project = await prisma.project.create({
                            data: {
                                name: projectName,
                                joinCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
                            }
                        })
                        activeProjectId = project.id
                        updateData.projectId = project.id
                        updateData.status = "ACTIVE"
                        memberRole = "ADMIN"
                        memberStatus = "ACTIVE"
                    } else if (role === "EMPLOYEE") {
                        // If join code provided, try to find project
                        if (decodedProjectInfo) {
                            const project = await prisma.project.findUnique({
                                where: { joinCode: decodedProjectInfo.toUpperCase() }
                            })

                            if (project) {
                                // Set as PENDING and don't assign projectId yet
                                // User won't see the project until admin approves
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                updateData.pendingProjectId = project.id as any
                                updateData.status = "PENDING"
                                // Don't set projectId - wait for admin approval
                                memberRole = "EMPLOYEE"
                                memberStatus = "PENDING"
                            }
                        }

                        // If no project joined (or code was invalid), create a Personal Workspace
                        if (!updateData.pendingProjectId && !activeProjectId) {
                            const personalProject = await prisma.project.create({
                                data: {
                                    name: `${user.name}'s Workspace`,
                                    joinCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
                                }
                            })
                            activeProjectId = personalProject.id
                            updateData.projectId = personalProject.id
                            updateData.status = "ACTIVE"
                            memberRole = "ADMIN"
                            memberStatus = "ACTIVE"
                        }
                    }

                    // Update the user record
                    await prisma.user.update({
                        where: { id: user.id },
                        data: updateData
                    })

                    // Create the membership record
                    if (activeProjectId) {
                        await prisma.projectMember.create({
                            data: {
                                userId: user.id,
                                projectId: activeProjectId,
                                role: memberRole,
                                status: memberStatus
                            }
                        })
                    }
                }
            } catch (error) {
                console.error("Error in createUser event:", error)
            }
        }
    },
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            // Debug Log
            // console.log("[AUTH] JWT Callback Triggered", { trigger, hasUser: !!user, hasSession: !!session })

            if (trigger === "update" && session) {
                console.log("[AUTH] Session Update Triggered", session.user)
                return { ...token, ...session.user }
            }

            if (user) {
                // Initial sign in
                console.log("[AUTH] User Login", { id: user.id, email: user.email, role: user.role })
                token.id = user.id
                token.role = user.role
                token.status = user.status
                token.managerId = user.managerId
                token.workDays = user.workDays
                token.dailyTarget = user.dailyTarget
                token.plan = user.plan
                token.projectId = user.projectId
            } else if (token.id) {
                // Subsequent request: fetch fresh role from DB to ensure sync
                // This fixes the "Stale Admin Role" issue
                try {
                    const freshUser = await prisma.user.findUnique({
                        where: { id: token.id as string },
                        select: {
                            role: true,
                            status: true,
                            managerId: true,
                            workDays: true,
                            dailyTarget: true,
                            plan: true,
                            projectId: true
                        }
                    })
                    if (freshUser) {
                        token.role = freshUser.role
                        token.status = freshUser.status
                        token.managerId = freshUser.managerId
                        token.workDays = freshUser.workDays
                        token.dailyTarget = freshUser.dailyTarget
                        token.projectId = freshUser.projectId

                        // Plan Inheritance Logic
                        let effectivePlan = freshUser.plan

                        if (freshUser.role !== 'ADMIN' && freshUser.projectId) {
                            // Find an Admin in the same project with a paid plan
                            const projectAdmin = await prisma.user.findFirst({
                                where: {
                                    projectId: freshUser.projectId,
                                    role: 'ADMIN',
                                    plan: { not: 'FREE' }
                                },
                                select: { plan: true }
                            })

                            if (projectAdmin) {
                                effectivePlan = projectAdmin.plan
                            }
                        }

                        token.plan = effectivePlan
                        // console.log("[AUTH] Refreshed Role from DB:", freshUser.role)
                    }
                } catch (error) {
                    console.error("[AUTH] Error refreshing user role:", error)
                }
            }
            return token
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id
                session.user.role = token.role
                session.user.status = token.status
                session.user.managerId = token.managerId
                session.user.workDays = token.workDays as number[]
                session.user.dailyTarget = token.dailyTarget as number | null
                session.user.plan = token.plan as string
                session.user.projectId = token.projectId as string | null
                // Debug Log (Comment out in production later if too noisy)
                // console.log("[AUTH] Session Callback", { email: session.user.email, role: session.user.role })
            }
            return session
        },
    },
}
