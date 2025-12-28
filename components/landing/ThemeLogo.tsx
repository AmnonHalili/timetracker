"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

interface ThemeLogoProps {
    width?: number
    height?: number
    className?: string
    priority?: boolean
}

/**
 * Logo component that changes based on the current theme
 * - Pink theme → collabologopink.png
 * - White theme → collabologoblack.png
 * - Black theme → collabologowhitenoback.png
 * - Blue theme → collabologo.png
 * - System theme (same as black) → collabologowhitenoback.png
 */
// Function to get logo path based on theme (can be called synchronously)
function getLogoForTheme(): string {
    // Only access localStorage on client side
    if (typeof window === 'undefined') {
        return "/collabologo.png" // SSR default
    }

    try {
        // Check localStorage for theme preference (primary source of truth)
        const theme = localStorage.getItem("theme") || localStorage.getItem("appTheme") || "blue"

        if (theme === "pink") {
            return "/collabologopink.png"
        }

        if (theme === "white") {
            return "/collabologoblack.png"
        }

        if (theme === "black" || theme === "system") {
            return "/collabologowhitenoback.png"
        }

        // Fallback: check DOM classes if localStorage doesn't have theme info
        const body = document.body
        const html = document.documentElement

        if (body.classList.contains("pink-theme") || html.classList.contains("pink-theme")) {
            return "/collabologopink.png"
        }

        if (body.classList.contains("white-theme") || html.classList.contains("white-theme")) {
            return "/collabologoblack.png"
        }

        // Check for dark mode (black theme or system theme)
        if (body.classList.contains("dark") &&
            html.classList.contains("dark") &&
            !body.classList.contains("white-theme") &&
            !body.classList.contains("pink-theme")) {
            return "/collabologowhitenoback.png"
        }
    } catch {
        // Fallback on error
    }

    // Default to blue theme
    return "/collabologo.png"
}

export function ThemeLogo({ width = 360, height = 144, className = "", priority = false }: ThemeLogoProps) {
    // Initialize state with the correct logo from localStorage immediately
    const [logoSrc, setLogoSrc] = useState(() => getLogoForTheme())

    useEffect(() => {
        const updateLogo = () => {
            setLogoSrc(getLogoForTheme())
        }

        // Update logo on mount (in case theme changed before component mounted)
        updateLogo()

        // Watch for theme changes via DOM mutations
        const observer = new MutationObserver(updateLogo)
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        })
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        })

        // Listen for storage changes (when theme is changed in another tab/window)
        const handleStorageChange = () => updateLogo()
        window.addEventListener("storage", handleStorageChange)

        // Check for theme changes when window gains focus (in case theme was changed in another tab)
        const handleFocus = () => updateLogo()
        window.addEventListener("focus", handleFocus)

        return () => {
            observer.disconnect()
            window.removeEventListener("storage", handleStorageChange)
            window.removeEventListener("focus", handleFocus)
        }
    }, [])

    // Always use logoSrc which is initialized correctly from localStorage
    return (
        <Image
            src={logoSrc}
            alt="Collabo Logo"
            width={width}
            height={height}
            className={className}
            priority={priority}
        />
    )
}

