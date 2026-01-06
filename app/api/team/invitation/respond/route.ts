import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const { projectId, action } = await req.json()

        if (!projectId || !action) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 })
        }

        const membership = await prisma.projectMember.findUnique({
            where: {
                userId_projectId: {
                    userId: session.user.id,
                    projectId
                }
            }
        })

        if (!membership) {
            return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
        }

        if (membership.status !== "INVITED") {
            return NextResponse.json({ error: "Invalid invitation status" }, { status: 400 })
        }

        if (action === "ACCEPT") {
            await prisma.projectMember.update({
                where: { id: membership.id },
                data: { status: "ACTIVE", joinedAt: new Date() }
            })
            return NextResponse.json({ success: true, message: "Invitation accepted" })
        } else if (action === "REJECT") {
            await prisma.projectMember.update({
                where: { id: membership.id },
                data: { status: "REJECTED" }
            })
            return NextResponse.json({ success: true, message: "Invitation rejected" })
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    } catch (error) {
        console.error("Error responding to invitation:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
