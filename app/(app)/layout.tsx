import { Suspense } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
// Providers moved to root layout
import { AccessibilityButton } from "@/components/accessibility/AccessibilityButton"
import { AppHeader } from "@/components/layout/AppHeader"
import { AdBanner } from "@/components/ads/AdBanner"

import { HeartbeatTracker } from "@/components/auth/HeartbeatTracker"

export default function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <HeartbeatTracker />
            <Sidebar />
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
