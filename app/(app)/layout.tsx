import { Sidebar } from "@/components/layout/Sidebar"
// Providers moved to root layout
import { NotificationBell } from "@/components/layout/NotificationBell"
import { AccessibilityButton } from "@/components/accessibility/AccessibilityButton"
import { ModeToggle } from "@/components/mode-toggle"

export default function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar />
            <main className="flex-1 overflow-y-scroll" id="main-content" role="main">
                <div className="flex items-center justify-end px-8 py-2 bg-background/95 backdrop-blur sticky top-0 z-10 gap-2">
                    <ModeToggle />
                    <NotificationBell />
                </div>
                <div className="px-8 pb-8 pt-2">
                    {children}
                </div>
            </main>
            <AccessibilityButton />
        </div>
    )
}
