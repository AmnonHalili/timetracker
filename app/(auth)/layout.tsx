import { ModeToggle } from "@/components/mode-toggle"

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="relative flex h-screen w-full items-center justify-center bg-muted/30">
            <div className="absolute top-4 right-4">
                <ModeToggle />
            </div>
            {children}
        </div>
    )
}
