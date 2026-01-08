import { Suspense } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
// Providers moved to root layout
import { AccessibilityButton } from "@/components/accessibility/AccessibilityButton"
import { AppHeader } from "@/components/layout/AppHeader"
import { AdBanner } from "@/components/ads/AdBanner"

import { HeartbeatTracker } from "@/components/auth/HeartbeatTracker"
import { ProjectProvider } from "@/components/providers/ProjectProvider"
import { ProjectLoadingOverlay } from "@/components/layout/ProjectLoadingOverlay"

export default function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <ProjectProvider>
            <div className="flex h-screen overflow-hidden bg-background">
                <HeartbeatTracker />
                <Sidebar />
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    <ProjectLoadingOverlay />
                    <AppHeader />
                    <main className="flex-1 overflow-y-scroll" id="main-content" role="main">
                        <div className="px-2 md:px-8 pb-8 pt-2">
                            <Suspense fallback={
                                <div className="flex h-[50vh] w-full items-center justify-center">
                                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                </div>
                            }>
                                {children}
                            </Suspense>
                        </div>
                    </main>
                </div>
                <AccessibilityButton />
                <AdBanner />
            </div>
        </ProjectProvider>
    )
}
