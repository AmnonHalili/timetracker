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
export function ThemeLogo({ width = 360, height = 144, className = "", priority = false }: ThemeLogoProps) {
    const [logoSrc, setLogoSrc] = useState("/collabologo.png") // Default to blue theme
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        
        // Function to determine which logo to use based on current theme
        const getLogoForTheme = () => {
            // Check localStorage for theme preference (primary source of truth)
            const theme = localStorage.getItem("theme") || localStorage.getItem("appTheme") || "blue"
            
            // Priority: check localStorage first, then DOM classes as fallback
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
            
            // Default to blue theme
            return "/collabologo.png"
        }

        const updateLogo = () => {
            setLogoSrc(getLogoForTheme())
        }

        // Initial logo update
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

    // Show default logo during SSR to avoid hydration mismatch
    if (!mounted) {
        return (
            <Image 
                src="/collabologo.png" 
                alt="Collabo Logo" 
                width={width} 
                height={height} 
                className={className}
                priority={priority}
            />
        )
    }

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

