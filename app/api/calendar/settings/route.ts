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
        const { isGoogleCalendarSyncEnabled, syncMode, syncedCalendarIds } = body

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
                syncedCalendarIds: syncedCalendarIds ? Array.from(new Set(syncedCalendarIds)) : ["primary"]
            },
            update: {
                isGoogleCalendarSyncEnabled,
                syncMode,
                syncedCalendarIds: syncedCalendarIds ? Array.from(new Set(syncedCalendarIds)) : undefined
            }
        })

        return NextResponse.json(settings)
    } catch (error) {
        console.error("Error updating calendar settings:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

export async function GET(_req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const [settings, googleAccount] = await Promise.all([
            prisma.calendarSettings.findUnique({
                where: { userId: session.user.id }
            }),
            prisma.account.findFirst({
                where: { userId: session.user.id, provider: "google" }
            })
        ])

        // Fetch available calendars if linked
        let availableCalendars: any[] = []
        if (googleAccount) {
            try {
                const { getUserCalendars } = await import("@/lib/google-calendar")
                availableCalendars = await getUserCalendars(session.user.id)
            } catch (e) {
                console.error("Failed to fetch user calendars", e)
            }
        }

        return NextResponse.json({
            ...settings,
            isGoogleCalendarSyncEnabled: settings?.isGoogleCalendarSyncEnabled ?? false,
            syncMode: settings?.syncMode ?? "FULL_DETAILS",
            syncedCalendarIds: settings?.syncedCalendarIds ?? ["primary"],
            isGoogleLinked: !!googleAccount,
            hasRefreshToken: !!googleAccount?.refresh_token,
            availableCalendars
        })
    } catch (error) {
        console.error("Error fetching calendar settings:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
