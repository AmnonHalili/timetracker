import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { projectId: true }
        })

        if (!currentUser?.projectId) {
            return NextResponse.json({ message: "No project found" }, { status: 404 })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const requests = await prisma.user.findMany({
            where: {
                pendingProjectId: currentUser.projectId
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any,
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true
            }
        })

        return NextResponse.json(requests)
    } catch (error) {
        console.error("Failed to fetch requests:", error)
        return NextResponse.json({ message: "Internal Error" }, { status: 500 })
    }
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const { userId, action } = await req.json()
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { projectId: true }
        })

        if (!currentUser?.projectId) {
            return NextResponse.json({ message: "No project found" }, { status: 404 })
        }

        // Verify the user is actually requesting THIS project
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            select: { pendingProjectId: true } as any
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any

        if (!targetUser || targetUser.pendingProjectId !== currentUser.projectId) {
            return NextResponse.json({ message: "Invalid request" }, { status: 400 })
        }

        if (action === "APPROVE") {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    pendingProjectId: null,
                    projectId: currentUser.projectId,
                    status: "ACTIVE", // Ensure active
                    managerId: session.user.id // Assign to approving admin as default manager
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any
            })
        } else if (action === "REJECT") {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    pendingProjectId: null
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any
            })
        } else {
            return NextResponse.json({ message: "Invalid action" }, { status: 400 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to process request:", error)
        return NextResponse.json({ message: "Internal Error" }, { status: 500 })
    }
}
