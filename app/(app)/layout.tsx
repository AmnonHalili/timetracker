import { Sidebar } from "@/components/layout/Sidebar"
import { Providers } from "@/components/layout/Providers"

export default function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <Providers>
            <div className="flex h-screen overflow-hidden bg-background">
                <Sidebar />
                <main className="flex-1 overflow-y-auto">
                    <div className="p-8">
                        {children}
                    </div>
                </main>
            </div>
        </Providers>
    )
}
