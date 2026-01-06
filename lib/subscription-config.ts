import { Plan } from "@prisma/client"

export const PLANS = [
    {
        name: "Free",
        slug: "free",
        quota: 3,
        price: {
            amount: 0,
            priceIds: {
                test: "",
                production: "",
            },
        },
    },
    {
        name: "Team",
        slug: "tier1",
        quota: 10,
        price: {
            amount: 49,
            priceIds: {
                test: "price_tier1_test", // User to replace
                production: "",
            },
        },
    },
    {
        name: "Business",
        slug: "tier2",
        quota: 20,
        price: {
            amount: 99,
            priceIds: {
                test: "price_tier2_test", // User to replace
                production: "",
            },
        },
    },
    {
        name: "Company",
        slug: "tier3",
        quota: Infinity, // Unlimited
        price: {
            amount: 199, // Base price
            perUserPrice: 8, // Per user above 20
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
            return 3
        case Plan.TIER1:
            return 10
        case Plan.TIER2:
            return 20
        case Plan.TIER3:
            return Infinity
        default:
            return 3
    }
}

// Calculate which tier a user count qualifies for
export function getRequiredTier(userCount: number): { tier: string; slug: string } | null {
    if (userCount <= 3) {
        return { tier: "Free", slug: "free" }
    } else if (userCount <= 10) {
        return { tier: "Team", slug: "tier1" }
    } else if (userCount <= 20) {
        return { tier: "Business", slug: "tier2" }
    } else {
        return { tier: "Company", slug: "tier3" }
    }
}

// Calculate Company tier price based on user count
export function calculateCompanyPrice(userCount: number): number {
    const basePrice = 199
    const usersAbove20 = Math.max(0, userCount - 20)
    return basePrice + (usersAbove20 * 8)
}
