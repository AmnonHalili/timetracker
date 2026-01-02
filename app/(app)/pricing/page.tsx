import { authOptions } from "@/lib/auth"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { PricingContent } from "@/components/pricing/PricingContent"

export default async function PricingPage() {
    const session = await getServerSession(authOptions)

    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'MEMBER')) {
        redirect("/dashboard")
    }

    return <PricingContent />
}

