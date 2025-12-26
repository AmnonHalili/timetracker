import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                role: true,
                projectId: true,
                id: true,
                project: {
                    select: { name: true, id: true }
                }
            }
        })

        if (!currentUser?.projectId) {
            // Return just the current user for Private Workspace
            const privateUser = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    image: true,
                    managerId: true,
                    jobTitle: true,
                }
            })

            return NextResponse.json({
                users: privateUser ? [privateUser] : [],
                projectName: "Private Workspace"
            })
        }

        // Fetch all users in the project
        // We fetch flat list and build tree securely in memory or rely on relation
        // For deep nesting, Prisma recursion is limited, but we can fetch all and rebuild
        let allUsers
        try {
            // Try to fetch with new fields first
            allUsers = await prisma.user.findMany({
                where: { projectId: currentUser.projectId },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    image: true,
                    managerId: true,
                    jobTitle: true,
                    sharedChiefGroupId: true,
                    createdAt: true,
                    secondaryManagers: {
                        include: {
                            manager: {
                                select: { id: true, name: true, image: true, email: true }
                            }
                        }
                    },
                    secondaryManagedUsers: {
                        include: {
                            employee: {
                                select: { id: true, name: true, image: true, email: true }
                            }
                        }
                    }
                } as never,
                orderBy: { createdAt: "asc" }
            })
        } catch (fieldError: unknown) {
            // If the field doesn't exist in Prisma client yet, fetch without it
            const error = fieldError as { message?: string }
            if (error.message?.includes('sharedChiefGroupId') || error.message?.includes('Unknown field') || error.message?.includes('secondaryManagers')) {
                console.warn("New fields not available in Prisma client, fetching without them")
                allUsers = await prisma.user.findMany({
                    where: { projectId: currentUser.projectId },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        image: true,
                        managerId: true,
                        jobTitle: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: "asc" }
                })
                // Add null values for missing fields
                allUsers = allUsers.map(user => ({
                    ...user,
                    sharedChiefGroupId: null,
                    secondaryManagers: [],
                    secondaryManagedUsers: []
                }))
            } else {
                throw fieldError
            }
        }

        // Robustly fetch project logo
        let projectLogo = null
        try {
            // Use findUnique with implicit selection to avoid crashing if 'logo' field is unknown to stale client
            const projectData = await prisma.project.findUnique({
                where: { id: currentUser.projectId }
            })

            projectLogo = projectData?.logo
        } catch (e) {
            console.error("Failed to fetch project logo (schema mismatch?)", e)
        }

        return NextResponse.json({
            users: allUsers,
            projectName: currentUser.project?.name || "My Organization",
            projectId: currentUser.project?.id,
            projectLogo
        })
    } catch (error) {
        console.error("[HIERARCHY_FETCH_ERROR]", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        return NextResponse.json({
            message: "Failed to fetch hierarchy",
            error: errorMessage
        }, { status: 500 })
    }
}
