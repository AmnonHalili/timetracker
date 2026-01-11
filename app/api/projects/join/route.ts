
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { createNotification } from "@/lib/create-notification"

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const { joinCode } = body

        if (!joinCode || typeof joinCode !== 'string') {
            return NextResponse.json({ error: "Join code is required" }, { status: 400 })
        }

        // 1. Find Project
        const project = await prisma.project.findUnique({
            where: { joinCode: joinCode.toUpperCase() }
        })

        if (!project) {
            return NextResponse.json({ error: "Invalid join code" }, { status: 404 })
        }

        // 2. Check if already a member
        const existingMember = await prisma.projectMember.findUnique({
            where: {
                userId_projectId: {
                    userId: session.user.id,
                    projectId: project.id
                }
            }
        })

        if (existingMember) {
            if (existingMember.status === 'ACTIVE') {
                return NextResponse.json({ error: "You are already a member of this project" }, { status: 400 })
            }
            if (existingMember.status === 'PENDING') {
                return NextResponse.json({ error: "Join request already sent" }, { status: 400 })
            }
            // If REJECTED or INVITED, we might allow re-request logic, but for now blocking duplicates simply
            return NextResponse.json({ error: "Membership status: " + existingMember.status }, { status: 400 })
        }

        // Get user info for notification
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { name: true, email: true }
        })

        // 3. Update user with pendingProjectId (for consistency with /api/team/join)
        // This allows /api/team/requests to find the pending request
        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                pendingProjectId: project.id as any
            }
        })

        // 4. Create Pending Membership (for multi-project support)
        await prisma.projectMember.create({
            data: {
                userId: session.user.id,
                projectId: project.id,
                role: 'EMPLOYEE', // Default role
                status: 'PENDING'
            }
        })

        // Notify Project Admins
        const admins = await prisma.user.findMany({
            where: {
                projectId: project.id,
                role: "ADMIN"
            }
        })

        // Send real-time notifications to each admin
        await Promise.all(admins.map(admin =>
            createNotification({
                userId: admin.id,
                title: "New Join Request",
                message: `${user?.name || user?.email || "A user"} has requested to join your project via Team Code.`,
                type: "INFO",
                link: "/team"
            })
        ))

        return NextResponse.json({ success: true, message: "Request sent to admin" })

    } catch (error) {
        console.error("Error joining project:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
