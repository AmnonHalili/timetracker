"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import { useState, useEffect } from "react"
import { signOut, useSession } from "next-auth/react"
import { stopActiveTimer } from "@/lib/utils"
import { useLanguage } from "@/lib/useLanguage"
import { ProjectSwitcher } from "@/components/layout/ProjectSwitcher"

export function MobileSidebar() {
    const pathname = usePathname()
    const { t, dir } = useLanguage()
    const { data: session } = useSession() // useSession from next-auth/react is already imported? Check imports.
    const [open, setOpen] = useState(false)
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0)

    // Check for pending join requests (only for admins)
    useEffect(() => {
        if (session?.user?.role === 'ADMIN' && pathname !== '/team') {
            const fetchPendingRequests = async () => {
                try {
                    const res = await fetch('/api/team/requests')
                    if (res.ok) {
                        const data = await res.json()
                        setPendingRequestsCount(data.length || 0)
                    }
                } catch (error) {
                    console.error('Failed to fetch pending requests:', error)
                }
            }
            fetchPendingRequests()
            // Poll every 30 seconds for new requests
            const interval = setInterval(fetchPendingRequests, 30000)
            return () => clearInterval(interval)
        } else {
            // Clear count when on team page or not admin
            setPendingRequestsCount(0)
        }
    }, [session?.user?.role, pathname])

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
        {
            href: "/team",
            label: t('nav.team'),
            active: pathname === "/team",
            badge: session?.user?.role === 'ADMIN' && pendingRequestsCount > 0 && pathname !== '/team',
            badgeCount: pendingRequestsCount,
        },
        {
            href: "/settings",
            label: t('nav.settings'),
            active: pathname === "/settings",
        },
    ]

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" className="md:hidden h-14 w-14 p-0 [&_svg]:!size-6">
                    <Menu className="h-6 w-6" />
                </Button>
            </SheetTrigger>
            <SheetContent side={dir === 'rtl' ? 'right' : 'left'} className="p-0 w-52 [&>button]:hidden">
                <div className="flex flex-col h-full bg-background">
                    <div className="px-4 py-6 border-b flex items-center justify-center z-10 relative">
                        <Link href="/dashboard" className="flex flex-col items-center gap-2" onClick={() => setOpen(false)}>
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

                    <div className="px-4 py-2 mt-4">
                        <ProjectSwitcher />
                    </div>

                    <nav className="flex-1 overflow-y-auto py-4" aria-label="Mobile navigation">
                        <div className="space-y-1 px-4">
                            {routes.map((route) => (
                                <Link
                                    key={route.href}
                                    href={route.href}
                                    prefetch={true}
                                    onClick={() => setOpen(false)}
                                    className={cn(
                                        "flex items-center px-4 py-3 text-base font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                        route.active
                                            ? "bg-muted text-primary"
                                            : "text-muted-foreground hover:bg-muted/50 hover:text-primary"
                                    )}
                                >
                                    <span className="flex-1">{route.label}</span>
                                    {route.badge && (
                                        route.badgeCount ? (
                                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                                                {route.badgeCount}
                                            </span>
                                        ) : (
                                            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                        )
                                    )}
                                </Link>
                            ))}
                        </div>
                    </nav>

                    <div className="p-4 space-y-0">
                        {(session?.user?.role === 'ADMIN' || session?.user?.role === 'MEMBER') && (
                            <Link
                                href="/pricing"
                                onClick={() => setOpen(false)}
                                className={cn(
                                    "flex items-center px-4 py-3 text-base font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
                                await stopActiveTimer()
                                signOut({ callbackUrl: "/login" })
                            }}
                        >
                            {t('nav.logout')}
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
