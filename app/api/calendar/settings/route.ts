import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const { isGoogleCalendarSyncEnabled, syncMode } = body

        // Validate syncMode if present
        if (syncMode && !["FULL_DETAILS", "BUSY_ONLY"].includes(syncMode)) {
            return NextResponse.json({ error: "Invalid sync mode" }, { status: 400 })
        }

        const settings = await prisma.calendarSettings.upsert({
            where: { userId: session.user.id },
            create: {
                userId: session.user.id,
                isGoogleCalendarSyncEnabled: isGoogleCalendarSyncEnabled ?? false,
                syncMode: syncMode ?? "FULL_DETAILS",
                syncedCalendarIds: ["primary"]
            },
            update: {
                isGoogleCalendarSyncEnabled,
                syncMode,
            }
        })

        return NextResponse.json(settings)
    } catch (error) {
        console.error("Error updating calendar settings:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const settings = await prisma.calendarSettings.findUnique({
            where: { userId: session.user.id }
        })

        return NextResponse.json(settings || { isGoogleCalendarSyncEnabled: false, syncMode: "FULL_DETAILS" })
    } catch (error) {
        console.error("Error fetching calendar settings:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
