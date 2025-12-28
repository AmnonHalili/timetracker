import { authOptions } from "@/lib/auth"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { PLANS } from "@/lib/subscription-config"
import { absoluteUrl } from "@/lib/utils"
import { prisma } from "@/lib/prisma"

const billingUrl = absoluteUrl("/pricing")

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user || !session?.user.email) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const body = await req.json()
        const { planId } = body

        if (!planId) {
            return new NextResponse("Plan ID required", { status: 400 })
        }

        const plan = PLANS.find((p) => p.slug === planId)

        if (!plan) {
            return new NextResponse("Invalid Plan ID", { status: 400 })
        }

        // Get the user from DB to check for existing stripeCustomerId
        const dbUser = await prisma.user.findUnique({
            where: {
                id: session.user.id,
            },
            select: {
                stripeCustomerId: true,
            },
        })

        if (!dbUser) {
            return new NextResponse("User not found", { status: 404 })
        }

        // If user already has a stripe customer ID, use it
        let customerId = dbUser.stripeCustomerId

        // If not, create one
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: session.user.email,
                name: session.user.name || undefined,
                metadata: {
                    userId: session.user.id,
                },
            })
            customerId = customer.id

            // Save it immediately
            await prisma.user.update({
                where: { id: session.user.id },
                data: { stripeCustomerId: customerId }
            })
        }

        // Create Checkout Session
        const stripeSession = await stripe.checkout.sessions.create({
            success_url: billingUrl,
            cancel_url: billingUrl,
            payment_method_types: ["card"],
            mode: "subscription",
            billing_address_collection: "auto",
            customer: customerId,
            line_items: [
                {
                    price: plan.price.priceIds.test, // TODO: Use production ID based on env
                    quantity: 1,
                },
            ],
            metadata: {
                userId: session.user.id,
                planId: planId,
            },
        })

        return NextResponse.json({ url: stripeSession.url })
    } catch (error) {
        console.error("[STRIPE_CHECKOUT]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
