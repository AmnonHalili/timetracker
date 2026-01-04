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
                        updateData.projectId = project.id
                        updateData.status = "ACTIVE" // Admins are active by default
                    } else if (role === "EMPLOYEE") {
                        // If join code provided, try to find project
                        if (decodedProjectInfo) {
                            const project = await prisma.project.findUnique({
                                where: { joinCode: decodedProjectInfo }
                            })

                            if (project) {
                                // Add to project but keep as PENDING until approved
                                updateData.projectId = project.id
                                updateData.status = "PENDING"
                            } else {
                                // Invalid code, still create user but without project
                                updateData.status = "PENDING"
                            }
                        } else {
                            updateData.status = "PENDING"
                        }
                    }

                    await prisma.user.update({
                        where: { id: user.id },
                        data: updateData
                    })
                }
            } catch (error) {
                console.error("Error in createUser event:", error)
            }
        }
    },
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (trigger === "update" && session) {
                return { ...token, ...session.user }
            }

            if (user) {
                // Initial login - populate from user object (legacy/global)
                token.id = user.id
                token.name = user.name
                token.email = user.email
                // Logic below will refresh from DB anyway for consistency
            }

            // Always fetch fresh data to support context switching/role updates
            if (token.id) {
                try {
                    const freshUser = await prisma.user.findUnique({
                        where: { id: token.id as string },
                        select: {
                            id: true,
                            projectId: true, // This is now the "Active Project"
                            plan: true,
                            role: true // Fallback
                        }
                    })

                    if (freshUser) {
                        let activeProjectId = freshUser.projectId;

                        // If no active project, try to find one
                        if (!activeProjectId) {
                            const firstMember = await prisma.projectMember.findFirst({
                                where: { userId: freshUser.id }
                            });
                            if (firstMember) {
                                activeProjectId = firstMember.projectId;
                                // Optional: Update user to set this as default?
                                // await prisma.user.update({ where: { id: freshUser.id }, data: { projectId: activeProjectId } })
                            }
                        }

                        if (activeProjectId) {
                            const member = await prisma.projectMember.findUnique({
                                where: {
                                    userId_projectId: {
                                        userId: freshUser.id,
                                        projectId: activeProjectId
                                    }
                                }
                            });

                            if (member) {
                                token.role = member.role;
                                token.status = member.status;
                                token.managerId = member.managerId;
                                token.workDays = member.workDays;
                                token.dailyTarget = member.dailyTarget;
                                token.projectId = activeProjectId;

                                // Plan inheritance logic (Scoped to Active Project)
                                let effectivePlan = freshUser.plan;
                                if (member.role !== 'ADMIN') {
                                    const projectAdmin = await prisma.projectMember.findFirst({
                                        where: {
                                            projectId: activeProjectId,
                                            role: 'ADMIN'
                                        },
                                        include: { user: { select: { plan: true } } }
                                    });
                                    if (projectAdmin?.user?.plan && projectAdmin.user.plan !== 'FREE') {
                                        effectivePlan = projectAdmin.user.plan;
                                    }
                                }
                                token.plan = effectivePlan;
                            }
                        } else {
                            // User has no projects at all
                            // Fallback to legacy fields or clear them
                            token.role = freshUser.role; // Use global role if exists (likely from signup)
                            token.projectId = null;
                        }
                    }
                } catch (error) {
                    console.error("[AUTH] Error refreshing user context:", error)
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
                // @ts-expect-error - session types extended
                session.user.projectId = token.projectId as string | null
            }
            return session
        },
    },
}
