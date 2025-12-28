import { Sidebar } from "@/components/layout/Sidebar"
// Providers moved to root layout
import { AccessibilityButton } from "@/components/accessibility/AccessibilityButton"
import { AppHeader } from "@/components/layout/AppHeader"

export default function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar />
            <main className="flex-1 overflow-y-scroll" id="main-content" role="main">
                <AppHeader />
                <div className="px-8 pb-8 pt-2">
                    {children}
                </div>
            </main>
            <AccessibilityButton />
        </div>
    )
}
