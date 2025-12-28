"use client"

import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "next-themes"
import { useEffect, useState } from "react"
import { stopActiveTimerOnUnload } from "@/lib/utils"
import { LanguageProvider } from "@/lib/useLanguage"

export function Providers({ children }: { children: React.ReactNode }) {
    const [initialTheme, setInitialTheme] = useState<string | undefined>(undefined)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        // Read theme from localStorage to set as default
        try {
            const nextTheme = localStorage.getItem('theme')
            const appTheme = localStorage.getItem('appTheme') || nextTheme || 'blue'
            setInitialTheme(appTheme)
        } catch {
            setInitialTheme('blue')
        }
    }, [])

    // Handle page unload (browser close/refresh) - stop active timer if running
    useEffect(() => {
        const handleBeforeUnload = () => {
            // Stop active timer before page unloads
            stopActiveTimerOnUnload()
        }

        window.addEventListener('beforeunload', handleBeforeUnload)

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
        }
    }, [])

    // Always wrap with LanguageProvider so useLanguage can be used anywhere
    // Don't render ThemeProvider until we know the theme to prevent flash
    if (!mounted) {
        return (
            <SessionProvider>
                <LanguageProvider>
                    {children}
                </LanguageProvider>
            </SessionProvider>
        )
    }

    return (
        <SessionProvider>
            <LanguageProvider>
                <ThemeProvider
                    attribute="class"
                    defaultTheme={initialTheme}
                    enableSystem={false}
                    disableTransitionOnChange
                    themes={["white", "blue", "black", "pink", "system"]}
                    storageKey="theme"
                >
                    {children}
                </ThemeProvider>
            </LanguageProvider>
        </SessionProvider>
    )
}
