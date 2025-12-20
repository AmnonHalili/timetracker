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
        const { dailyTarget } = await req.json()

        if (typeof dailyTarget !== 'number' || dailyTarget < 0) {
            return NextResponse.json({ message: "Invalid daily target" }, { status: 400 })
        }

        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: { dailyTarget },
            select: { id: true, dailyTarget: true }
        })

        return NextResponse.json({ user: updatedUser, message: "Preferences updated successfully" })
    } catch (error) {
        console.error("[PREFERENCES_UPDATE_ERROR]", error)
        return NextResponse.json({ message: "Failed to update preferences" }, { status: 500 })
    }
}
