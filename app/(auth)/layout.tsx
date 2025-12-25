

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="relative flex h-screen w-full items-center justify-center bg-muted/30">

            {children}
        </div>
    )
}
