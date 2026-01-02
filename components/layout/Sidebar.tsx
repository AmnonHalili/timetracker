"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useSession, signOut } from "next-auth/react"
import { stopActiveTimer } from "@/lib/utils"
import { useLanguage } from "@/lib/useLanguage"

export function Sidebar() {
    const pathname = usePathname()
    const { t } = useLanguage()
    const { data: session } = useSession()

    const [isDismissed, setIsDismissed] = useState(true) // Default to true to prevent flash

    useEffect(() => {
        // Check local storage on mount
        const dismissed = localStorage.getItem('settings_badge_dismissed') === 'true'
        setIsDismissed(dismissed)
    }, [])

    useEffect(() => {
        if (pathname === '/settings') {
            localStorage.setItem('settings_badge_dismissed', 'true')
            setIsDismissed(true)
        }
    }, [pathname])

    // Check if user is a top-level admin with incomplete profile
    // Only show badge if NOT on settings page AND not remembered as seen
    const showSettingsBadge = session?.user?.role === 'ADMIN' &&
        !session?.user?.managerId &&
        (!session?.user?.workDays?.length || !session?.user?.dailyTarget) &&
        pathname !== '/settings' &&
        !isDismissed

    const routes = [
        {
            href: "/dashboard",
            label: t('nav.dashboard'),
            active: pathname === "/dashboard",
        },
        {
            href: "/tasks",
            label: t('nav.tasks'),
            active: pathname === "/tasks",
        },
        {
            href: "/calendar",
            label: t('nav.calendar'),
            active: pathname === "/calendar",
        },
        {
            href: "/reports",
            label: t('nav.reports'),
            active: pathname === "/reports",
        },
        // Team route logic (assuming admin only later, but for now just showing it)
        {
            href: "/team",
            label: t('nav.team'),
            active: pathname === "/team",
        },
        {
            href: "/settings",
            label: t('nav.settings'),
            active: pathname === "/settings",
            badge: showSettingsBadge
        },
    ]

    return (
        <aside className="hidden md:flex flex-col h-screen w-52 border-r border-l bg-background shrink-0" aria-label="Main navigation">
            <div className="px-4 py-6 border-b flex items-center justify-center z-10 relative">
                <Link href="/dashboard" className="flex flex-col items-center gap-2" aria-label="Collabo Home">
                    {/* Pink Theme Logo */}
                    <div className="hidden [.pink-theme_&]:block">
                        <Image
                            src="/collabologopink.png"
                            alt="Collabo Logo"
                            width={80}
                            height={80}
                            className="h-16 w-auto"
                            priority
                        />
                    </div>

                    {/* White Theme Logo */}
                    <div className="hidden [.white-theme_&]:block">
                        <Image
                            src="/collabologoblack.png"
                            alt="Collabo Logo"
                            width={80}
                            height={80}
                            className="h-16 w-auto"
                            priority
                        />
                    </div>

                    {/* Default Logos (Blue/Dark) - Hide if pink or white theme is active */}
                    <div className="[.pink-theme_&]:hidden [.white-theme_&]:hidden">
                        <Image
                            src="/collabologo.png"
                            alt="Collabo Logo"
                            width={80}
                            height={80}
                            className="h-16 w-auto dark:hidden"
                            priority
                        />
                        <Image
                            src="/collabologowhitenoback.png"
                            alt="Collabo Logo"
                            width={80}
                            height={80}
                            className="h-16 w-auto hidden dark:block"
                            priority
                        />
                    </div>
                </Link>
            </div>

            <nav className="flex-1 overflow-y-auto py-6" aria-label="Primary navigation">
                <div className="space-y-1 px-4">
                    {routes.map((route) => (
                        <Link
                            key={route.href}
                            href={route.href}
                            prefetch={true}
                            className={cn(
                                "flex items-center justify-between px-4 py-3 text-sm font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                route.active
                                    ? "bg-muted text-primary"
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-primary"
                            )}
                            aria-current={route.active ? "page" : undefined}
                        >
                            {route.label}

                            {route.badge && (
                                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                            )}
                        </Link>
                    ))}
                </div>
            </nav>

            <div className="px-4 space-y-0 pt-4">
                {(session?.user?.role === 'ADMIN' || session?.user?.role === 'MEMBER') && (
                    <Link
                        href="/pricing"
                        className={cn(
                            "flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            pathname === "/pricing"
                                ? "bg-muted text-primary"
                                : "text-muted-foreground hover:bg-muted/50 hover:text-primary"
                        )}
                        prefetch={true}
                    >
                        {t('nav.upgradeToPro')}
                    </Link>
                )}
                <div className="border-t my-2"></div>
                <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={async () => {
                        // Stop active timer before logging out
                        await stopActiveTimer()
                        signOut({ callbackUrl: "/login" })
                    }}
                    aria-label={t('nav.logout')}
                >
                    {t('nav.logout')}
                </Button>
            </div>
        </aside>
    )
}
