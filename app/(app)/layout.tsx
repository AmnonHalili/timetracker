import { Sidebar } from "@/components/layout/Sidebar"
// Providers moved to root layout
import { NotificationBell } from "@/components/layout/NotificationBell"
import { AccessibilityButton } from "@/components/accessibility/AccessibilityButton"


import { MobileSidebar } from "@/components/layout/MobileSidebar"

export default function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar />
            <main className="flex-1 overflow-y-scroll" id="main-content" role="main">
                <div className="flex items-center justify-between px-4 md:px-8 py-2 bg-background/95 backdrop-blur sticky top-0 z-10 gap-2">
                    <div className="md:hidden">
                        <MobileSidebar />
                    </div>
                    {/* Mobile Logo (Centered) */}
                    <div className="absolute left-1/2 -translate-x-1/2 md:hidden font-bold text-xl text-primary tracking-tight uppercase">
                        COLLABO
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        <NotificationBell />
                    </div>
                </div>
                <div className="px-8 pb-8 pt-2">
                    {children}
                </div>
            </main>
            <AccessibilityButton />
        </div>
    )
}
