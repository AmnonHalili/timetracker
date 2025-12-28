import { authOptions } from "@/lib/auth"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { generateDailySnapshot, backfillSnapshots } from "@/lib/analytics/snapshot-generator"

/**
 * POST /api/analytics/snapshot
 * Generates analytics snapshot for current user
 * Can also backfill historical data
 */
export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { backfill, days } = body

        if (backfill) {
            const backfillDays = days || 30
            await backfillSnapshots(session.user.id, backfillDays)

            return NextResponse.json({
                message: `Successfully backfilled ${backfillDays} days of analytics`,
                days: backfillDays
            })
        } else {
            await generateDailySnapshot(session.user.id)

            return NextResponse.json({
                message: "Analytics snapshot generated successfully"
            })
        }
    } catch (error) {
        console.error("Error generating snapshot:", error)
        return NextResponse.json(
            { message: "Error generating snapshot" },
            { status: 500 }
        )
    }
}
