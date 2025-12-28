import { headers } from "next/headers"
import Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { prisma } from "@/lib/prisma"
import { Plan } from "@prisma/client"

export async function POST(req: Request) {
    const body = await req.text()
    const signature = headers().get("Stripe-Signature") as string

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        )
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        return new Response(`Webhook Error: ${errorMessage}`, { status: 400 })
    }

    const session = event.data.object as Stripe.Checkout.Session

    if (event.type === "checkout.session.completed") {
        // Retrieve the subscription details from Stripe.
        const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
        )

        if (!session?.metadata?.userId) {
            return new Response("User id is required", { status: 400 })
        }

        // Determine plan from metadata or price ID
        const planId = session.metadata.planId
        let dbPlan: Plan = Plan.FREE

        if (planId === 'tier1') dbPlan = Plan.TIER1
        if (planId === 'tier2') dbPlan = Plan.TIER2
        if (planId === 'tier3') dbPlan = Plan.TIER3

        await prisma.user.update({
            where: {
                id: session.metadata.userId,
            },
            data: {
                stripeSubscriptionId: subscription.id,
                stripeCustomerId: subscription.customer as string,
                stripePriceId: subscription.items.data[0].price.id,
                stripeCurrentPeriodEnd: new Date(
                    subscription.current_period_end * 1000
                ),
                plan: dbPlan,
            },
        })
    }

    if (event.type === "invoice.payment_succeeded") {
        const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
        )

        await prisma.user.update({
            where: {
                stripeSubscriptionId: subscription.id,
            },
            data: {
                stripePriceId: subscription.items.data[0].price.id,
                stripeCurrentPeriodEnd: new Date(
                    subscription.current_period_end * 1000
                ),
            },
        })
    }

    return new Response(null, { status: 200 })
}
