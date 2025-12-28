import { Plan } from "@prisma/client"

export const PLANS = [
    {
        name: "Free",
        slug: "free",
        quota: 5,
        price: {
            amount: 0,
            priceIds: {
                test: "",
                production: "",
            },
        },
    },
    {
        name: "Tier 1",
        slug: "tier1",
        quota: 20,
        price: {
            amount: 5,
            priceIds: {
                test: "price_tier1_test", // User to replace
                production: "",
            },
        },
    },
    {
        name: "Tier 2",
        slug: "tier2",
        quota: 50,
        price: {
            amount: 12,
            priceIds: {
                test: "price_tier2_test", // User to replace
                production: "",
            },
        },
    },
    {
        name: "Tier 3",
        slug: "tier3",
        quota: 999999, // Unlimited
        price: {
            amount: 25,
            priceIds: {
                test: "price_tier3_test", // User to replace
                production: "",
            },
        },
    },
]

export function getPlanLimit(plan: Plan) {
    switch (plan) {
        case Plan.FREE:
            return 5
        case Plan.TIER1:
            return 20
        case Plan.TIER2:
            return 50
        case Plan.TIER3:
            return Infinity
        default:
            return 5
    }
}
