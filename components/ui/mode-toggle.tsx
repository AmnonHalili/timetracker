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

export function ModeToggle() {
    const { theme, setTheme, resolvedTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // Separate effect to handle system theme with resolvedTheme
    useEffect(() => {
        if (!mounted || theme !== "system") return
        
        const body = document.body
        const html = document.documentElement
        
        // Check system preference directly, but also use resolvedTheme as fallback
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
        const isDark = resolvedTheme === "dark" || (resolvedTheme === undefined && systemPrefersDark)
        
        // When system theme is active, apply white/black based on system preference
        if (isDark) {
            // Dark mode → black theme
            body.classList.add("dark")
            html.classList.add("dark")
            body.classList.remove("white-theme")
            html.classList.remove("white-theme")
        } else {
            // Light mode → white theme
            body.classList.remove("dark")
            html.classList.remove("dark")
            body.classList.add("white-theme")
            html.classList.add("white-theme")
        }
        body.classList.remove("pink-theme")
        html.classList.remove("pink-theme")
    }, [theme, resolvedTheme, mounted])

    useEffect(() => {
        if (!mounted) return
        
        const body = document.body
        const html = document.documentElement
        
        const applyTheme = (currentTheme: string | undefined, resolved: string | undefined) => {
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
                // System theme: apply immediately based on system preference
                const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
                if (systemPrefersDark) {
                    // Dark mode → black theme
                    body.classList.add("dark")
                    html.classList.add("dark")
                    body.classList.remove("white-theme")
                    html.classList.remove("white-theme")
                } else {
                    // Light mode → white theme
                    body.classList.remove("dark")
                    html.classList.remove("dark")
                    body.classList.add("white-theme")
                    html.classList.add("white-theme")
                }
                body.classList.remove("pink-theme")
                html.classList.remove("pink-theme")
                localStorage.setItem("appTheme", "system")
                localStorage.setItem("theme", "system")
            }
        }
        
        applyTheme(theme, resolvedTheme)
        
        // Listen for system preference changes when theme is "system"
        if (theme === "system" || !theme) {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
            const handleChange = () => {
                if (theme === "system" || !theme) {
                    // Re-apply system theme when preference changes
                    // Use resolvedTheme or check system preference
                    const isDark = resolvedTheme === "dark" || 
                                  window.matchMedia("(prefers-color-scheme: dark)").matches
                    if (isDark) {
                        // Dark mode → black theme
                        body.classList.add("dark")
                        html.classList.add("dark")
                        body.classList.remove("white-theme")
                        html.classList.remove("white-theme")
                    } else {
                        // Light mode → white theme
                        body.classList.remove("dark")
                        html.classList.remove("dark")
                        body.classList.add("white-theme")
                        html.classList.add("white-theme")
                    }
                    body.classList.remove("pink-theme")
                    html.classList.remove("pink-theme")
                }
            }
            mediaQuery.addEventListener("change", handleChange)
            return () => mediaQuery.removeEventListener("change", handleChange)
        }
    }, [theme, resolvedTheme, mounted])

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
            // System: show Moon if dark mode, Sun if light mode
            const systemPrefersDark = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
            const isDark = resolvedTheme === "dark" || (resolvedTheme === undefined && systemPrefersDark)
            return isDark ? <Moon className="h-[1.2rem] w-[1.2rem]" /> : <Sun className="h-[1.2rem] w-[1.2rem]" />
        } else {
            // default
            return <Sun className="h-[1.2rem] w-[1.2rem]" />
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                    {getIcon()}
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("white")}>
                    White
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("black")}>
                    Black
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                    System
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("blue")}>
                    Blue
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("pink")}>
                    Pink
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
