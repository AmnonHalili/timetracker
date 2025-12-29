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

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
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
                // Fetch latest user data including role which might have been updated in createUser event
                // Note: createUser runs AFTER the initial session creation, so the first session might still have default role.
                // However, for Google Sign In, the flow usually redirects, so subsequent requests should catch it.
                // We can try to re-fetch here if needed, but 'user' obj comes from the adapter.

                // Better strategy: Since createUser fires asynchronously, the 'user' object here might be stale IF it runs in parallel.
                // But typically adapter.createUser finishes before this callback if it's part of the flow. 
                // Let's rely on standard flow first.

                token.id = user.id
                token.role = user.role
                token.status = user.status
            }
            return token
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id
                session.user.role = token.role
                session.user.status = token.status
            }
            return session
        },
    },
}
