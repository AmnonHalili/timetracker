import { Sidebar } from "@/components/layout/Sidebar"
import { Providers } from "@/components/layout/Providers"
import { NotificationBell } from "@/components/layout/NotificationBell"

export default function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <Providers>
            <div className="flex h-screen overflow-hidden bg-background">
                <Sidebar />
                <main className="flex-1 overflow-y-scroll">
                    <div className="flex items-center justify-end px-8 py-2 bg-background/95 backdrop-blur sticky top-0 z-10">
                        <NotificationBell />
                    </div>
                    <div className="px-8 pb-8 pt-2">
                        {children}
                    </div>
                </main>
            </div>
        </Providers>
    )
}
