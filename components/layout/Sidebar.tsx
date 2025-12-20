"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { UserNav } from "./UserNav"
import { signOut } from "next-auth/react"
import { NotificationBell } from "./NotificationBell"

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
        <div className="flex flex-col h-screen w-64 border-r bg-background">
            <div className="p-6 border-b flex items-center justify-between">
                <Link href="/dashboard" className="text-xl font-bold">
                    HourTrack
                </Link>
                <NotificationBell />
            </div>

            <div className="flex-1 overflow-y-auto py-6">
                <nav className="space-y-1 px-4">
                    {routes.map((route) => (
                        <Link
                            key={route.href}
                            href={route.href}
                            className={cn(
                                "flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors",
                                route.active
                                    ? "bg-muted text-primary"
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-primary"
                            )}
                        >
                            {route.label}
                        </Link>
                    ))}
                </nav>
            </div>

            <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => signOut({ callbackUrl: "/login" })}
            >
                Log out
            </Button>
        </div>
    )
}
