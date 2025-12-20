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
        const { name, image } = await req.json()

        // Basic validation
        if (!name && !image) {
            return NextResponse.json({ message: "Nothing to update" }, { status: 400 })
        }

        const data: any = {}
        if (name) data.name = name
        if (image !== undefined) data.image = image // Allow clearing image if explicitly null? for now assume string

        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data,
            select: { id: true, name: true, email: true, image: true }
        })

        return NextResponse.json({ user: updatedUser, message: "Profile updated successfully" })
    } catch (error) {
        console.error("[PROFILE_UPDATE_ERROR]", error)
        return NextResponse.json({ message: "Failed to update profile" }, { status: 500 })
    }
}
