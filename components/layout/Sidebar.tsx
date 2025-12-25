"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

import { signOut } from "next-auth/react"

export function Sidebar() {
    const pathname = usePathname()

    const routes = [
        {
            href: "/dashboard",
            label: "Time Tracker",
            active: pathname === "/dashboard",
        },
        {
            href: "/tasks",
            label: "Tasks",
            active: pathname === "/tasks",
        },
        {
            href: "/calendar",
            label: "Calendar",
            active: pathname === "/calendar",
        },
        {
            href: "/reports",
            label: "Reports",
            active: pathname === "/reports",
        },
        // Team route logic (assuming admin only later, but for now just showing it)
        {
            href: "/team",
            label: "Team",
            active: pathname === "/team",
        },
        {
            href: "/settings",
            label: "Settings",
            active: pathname === "/settings",
        },
    ]

    return (
        <aside className="flex flex-col h-screen w-52 border-r bg-background" aria-label="Main navigation">
            <div className="px-4 pt-4 pb-0 border-b flex items-center justify-center z-10 relative">
                <Link href="/dashboard" className="flex items-center gap-2" aria-label="Collabo Home">
                    <Image src="/logo.png?v=4" alt="Collabo Logo" width={200} height={80} className="h-36 w-auto -mb-6 -mt-10" priority />
                </Link>
            </div>

            <nav className="flex-1 overflow-y-auto py-6" aria-label="Primary navigation">
                <div className="space-y-1 px-4">
                    {routes.map((route) => (
                        <Link
                            key={route.href}
                            href={route.href}
                            className={cn(
                                "flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                route.active
                                    ? "bg-muted text-primary"
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-primary"
                            )}
                            aria-current={route.active ? "page" : undefined}
                        >
                            {route.label}
                        </Link>
                    ))}
                </div>
            </nav>

            <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => signOut({ callbackUrl: "/login" })}
                aria-label="Log out"
            >
                Log out
            </Button>
        </aside>
    )
}
