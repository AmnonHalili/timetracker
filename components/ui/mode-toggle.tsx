"use client"

import * as React from "react"
import { Moon, Sun, Palette } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLanguage } from "@/lib/useLanguage"

export function ModeToggle() {
    const { theme, setTheme } = useTheme()
    const { t, dir } = useLanguage()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // Separate effect to handle system theme - always apply dark mode (same as black theme)
    useEffect(() => {
        if (!mounted || theme !== "system") return

        const body = document.body
        const html = document.documentElement

        // System theme always applies dark mode (same as black theme)
        body.classList.add("dark")
        html.classList.add("dark")
        body.classList.remove("white-theme")
        html.classList.remove("white-theme")
        body.classList.remove("pink-theme")
        html.classList.remove("pink-theme")
    }, [theme, mounted])

    useEffect(() => {
        if (!mounted) return

        const body = document.body
        const html = document.documentElement

        const applyTheme = (currentTheme: string | undefined) => {
            // Handle theme changes
            if (currentTheme === "pink") {
                // Pink theme: light mode + pink colors
                body.classList.remove("dark")
                html.classList.remove("dark")
                body.classList.remove("white-theme")
                html.classList.remove("white-theme")
                body.classList.add("pink-theme")
                html.classList.add("pink-theme")
                localStorage.setItem("appTheme", "pink")
                // Also save to next-themes storage
                localStorage.setItem("theme", "pink")
            } else if (currentTheme === "white") {
                // White theme: white background with black buttons
                body.classList.remove("dark")
                html.classList.remove("dark")
                body.classList.add("white-theme")
                html.classList.add("white-theme")
                body.classList.remove("pink-theme")
                html.classList.remove("pink-theme")
                localStorage.setItem("appTheme", "white")
                localStorage.setItem("theme", "white")
            } else if (currentTheme === "blue") {
                // Blue theme: light mode (current default white)
                body.classList.remove("dark")
                html.classList.remove("dark")
                body.classList.remove("white-theme")
                html.classList.remove("white-theme")
                body.classList.remove("pink-theme")
                html.classList.remove("pink-theme")
                localStorage.setItem("appTheme", "blue")
                localStorage.setItem("theme", "blue")
            } else if (currentTheme === "black") {
                // Black theme: dark mode
                body.classList.add("dark")
                html.classList.add("dark")
                body.classList.remove("white-theme")
                html.classList.remove("white-theme")
                body.classList.remove("pink-theme")
                html.classList.remove("pink-theme")
                localStorage.setItem("appTheme", "black")
                localStorage.setItem("theme", "black")
            } else if (currentTheme === "system" || !currentTheme) {
                // System theme: always apply dark mode (same as black theme)
                body.classList.add("dark")
                html.classList.add("dark")
                body.classList.remove("white-theme")
                html.classList.remove("white-theme")
                body.classList.remove("pink-theme")
                html.classList.remove("pink-theme")
                localStorage.setItem("appTheme", "system")
                localStorage.setItem("theme", "system")
            }
        }

        applyTheme(theme)

        // System theme always applies dark mode, no need to listen for system preference changes
    }, [theme, mounted])

    if (!mounted) {
        return (
            <Button variant="outline" size="icon">
                <Sun className="h-[1.2rem] w-[1.2rem]" />
                <span className="sr-only">Toggle theme</span>
            </Button>
        )
    }

    const getIcon = () => {
        if (theme === "pink") {
            return <Palette className="h-[1.2rem] w-[1.2rem]" />
        } else if (theme === "blue") {
            return <Palette className="h-[1.2rem] w-[1.2rem]" />
        } else if (theme === "black") {
            return <Moon className="h-[1.2rem] w-[1.2rem]" />
        } else if (theme === "white") {
            return <Sun className="h-[1.2rem] w-[1.2rem]" />
        } else if (theme === "system") {
            // System theme always shows Moon icon (always dark mode)
            return <Moon className="h-[1.2rem] w-[1.2rem]" />
        } else {
            // default
            return <Sun className="h-[1.2rem] w-[1.2rem]" />
        }
    }

    return (
        <DropdownMenu dir={dir}>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                    {getIcon()}
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("white")}>
                    {t('appearance.theme.white')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("black")}>
                    {t('appearance.theme.black')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                    {t('appearance.theme.system')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("blue")}>
                    {t('appearance.theme.blue')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("pink")}>
                    {t('appearance.theme.pink')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
