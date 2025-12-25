import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const payload: Record<string, unknown> = await req.json()

        // Basic validation
        if (!payload.name && payload.image === undefined && payload.jobTitle === undefined) {
            return NextResponse.json({ message: "Nothing to update" }, { status: 400 })
        }

        const data: Record<string, unknown> = {}
        if (payload.name) data.name = payload.name
        if (payload.image !== undefined) data.image = payload.image
        if (payload.jobTitle !== undefined) data.jobTitle = payload.jobTitle || null

        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data,
            select: { id: true, name: true, email: true, image: true, jobTitle: true }
        })

        return NextResponse.json({ user: updatedUser, message: "Profile updated successfully" })
    } catch (error) {
        console.error("[PROFILE_UPDATE_ERROR]", error)
        return NextResponse.json({ message: "Failed to update profile" }, { status: 500 })
    }
}
