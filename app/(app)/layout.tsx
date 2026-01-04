import { Suspense } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
// Providers moved to root layout
import { AccessibilityButton } from "@/components/accessibility/AccessibilityButton"
import { AppHeader } from "@/components/layout/AppHeader"
import { AdBanner } from "@/components/ads/AdBanner"

import { HeartbeatTracker } from "@/components/auth/HeartbeatTracker"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export default async function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await getServerSession(authOptions)

    // Fetch projects for the switcher
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let projects: any[] = []
    if (session?.user?.id) {
        const memberships = await prisma.projectMember.findMany({
            where: { userId: session.user.id },
            include: { project: true }
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        projects = memberships.map((m: any) => ({
            label: m.project.name,
            value: m.projectId,
            plan: "Free", // TODO: Get from project/subscription
            initials: m.project.name.substring(0, 2).toUpperCase(),
            image: m.project.logo
        }))
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <HeartbeatTracker />
            <Sidebar projects={projects} />
            <main className="flex-1 overflow-y-scroll" id="main-content" role="main">
                <AppHeader />
                <div className="px-8 pb-8 pt-2">
                    <Suspense fallback={
                        <div className="flex h-[50vh] w-full items-center justify-center">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        </div>
                    }>
                        {children}
                    </Suspense>
                </div>
            </main>
            <AccessibilityButton />
            <AdBanner />
        </div>
    )
}
