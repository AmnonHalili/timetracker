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
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                projectId: true,
                stripeCustomerId: true,
                stripeCurrentPeriodEnd: true,
                stripeSubscriptionId: true,
                stripePriceId: true,
                plan: true,
            }
        })

        if (!user) {
            return NextResponse.json({ isFree: true, plan: 'FREE' })
        }

        // Check if user has a valid paid plan
        // The plan field is what matters most now
        // We can also check stripeCurrentPeriodEnd if we want to be strict about expiry
        // but typically webhooks handle downgrading to FREE on expiry.
        // For now, trust the 'plan' field.

        const isFree = user.plan === 'FREE'

        // Count users in project for usage display
        let userCount = 0
        if (user.projectId) {
            userCount = await prisma.user.count({
                where: { projectId: user.projectId, status: "ACTIVE" }
            })
        }

        console.log(`[SUBSCRIPTION_CHECK] User ${session.user.id}, Plan: ${user.plan}, IsFree: ${isFree}`)

        return NextResponse.json({
            isFree,
            plan: user.plan, // FREE, TIER1, TIER2, TIER3
            userCount,
            stripeCustomerId: user.stripeCustomerId
        })
    } catch (error) {
        console.error("[SUBSCRIPTION_CHECK_ERROR]", error)
        return NextResponse.json({ isFree: true, plan: 'FREE' })
    }
}

