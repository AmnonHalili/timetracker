"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import { useEffect, useState } from "react"
import { signOut } from "next-auth/react"
import { stopActiveTimer } from "@/lib/utils"
import { useLanguage } from "@/lib/useLanguage"

export function MobileSidebar() {
    const pathname = usePathname()
    const { t, dir } = useLanguage()
    const [isPinkTheme, setIsPinkTheme] = useState(false)
    const [isWhiteTheme, setIsWhiteTheme] = useState(false)
    const [open, setOpen] = useState(false)

    useEffect(() => {
        // Check which theme is active
        const checkTheme = () => {
            const body = document.body
            const html = document.documentElement
            // Check both class and localStorage
            const isPink = body.classList.contains("pink-theme") ||
                html.classList.contains("pink-theme") ||
                localStorage.getItem("theme") === "pink" ||
                localStorage.getItem("appTheme") === "pink"
            const isWhite = body.classList.contains("white-theme") ||
                html.classList.contains("white-theme") ||
                localStorage.getItem("theme") === "white" ||
                localStorage.getItem("appTheme") === "white"
            setIsPinkTheme(isPink)
            setIsWhiteTheme(isWhite)
        }

        checkTheme()

        // Watch for theme changes
        const observer = new MutationObserver(checkTheme)
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        })
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        })

        // Also listen to storage changes
        const handleStorageChange = () => checkTheme()
        window.addEventListener("storage", handleStorageChange)

        return () => {
            observer.disconnect()
            window.removeEventListener("storage", handleStorageChange)
        }
    }, [])

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
            href: "/insights",
            label: t('nav.insights'),
            active: pathname === "/insights",
        },
        {
            href: "/team",
            label: t('nav.team'),
            active: pathname === "/team",
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
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-6 w-6" />
                </Button>
            </SheetTrigger>
            <SheetContent side={dir === 'rtl' ? 'right' : 'left'} className="p-0 w-52 [&>button]:hidden">
                <div className="flex flex-col h-full bg-background">
                    <div className="px-4 py-6 border-b flex items-center justify-center z-10 relative">
                        <Link href="/dashboard" className="flex flex-col items-center gap-2" onClick={() => setOpen(false)}>
                            {isPinkTheme ? (
                                <>
                                    <Image
                                        src="/collabologopink.png"
                                        alt="Collabo Logo"
                                        width={80}
                                        height={80}
                                        className="h-16 w-auto dark:hidden"
                                        priority
                                    />
                                    <Image
                                        src="/collabologopink.png"
                                        alt="Collabo Logo"
                                        width={80}
                                        height={80}
                                        className="h-16 w-auto hidden dark:block"
                                        priority
                                    />
                                </>
                            ) : isWhiteTheme ? (
                                <>
                                    <Image
                                        src="/collabologoblack.png"
                                        alt="Collabo Logo"
                                        width={80}
                                        height={80}
                                        className="h-16 w-auto"
                                        priority
                                    />
                                </>
                            ) : (
                                <>
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
                                </>
                            )}
                        </Link>
                    </div>

                    <nav className="flex-1 overflow-y-auto py-6" aria-label="Mobile navigation">
                        <div className="space-y-1 px-4">
                            {routes.map((route) => (
                                <Link
                                    key={route.href}
                                    href={route.href}
                                    onClick={() => setOpen(false)}
                                    className={cn(
                                        "flex items-center px-4 py-3 text-base font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                        route.active
                                            ? "bg-muted text-primary"
                                            : "text-muted-foreground hover:bg-muted/50 hover:text-primary"
                                    )}
                                >
                                    {route.label}
                                </Link>
                            ))}
                        </div>
                    </nav>

                    <div className="p-4 border-t">
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
