"use client"

import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "next-themes"
import { useEffect, useState } from "react"

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

    // Don't render ThemeProvider until we know the theme to prevent flash
    if (!mounted) {
        return <SessionProvider>{children}</SessionProvider>
    }

    return (
        <SessionProvider>
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
        </SessionProvider>
    )
}
