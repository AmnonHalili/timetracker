"use client"

import Image from "next/image"

interface ThemeLogoProps {
    width?: number
    height?: number
    className?: string
    priority?: boolean
}

export function ThemeLogo({ width = 360, height = 144, className = "", priority = false }: ThemeLogoProps) {
    return (
        <div className={`relative ${className}`} style={{ width: height * (width / height), height }}>
            {/* Pink Theme Logo */}
            <div className="hidden [.pink-theme_&]:block absolute inset-0">
                <Image
                    src="/collabologopink.png"
                    alt="Collabo Logo"
                    width={width}
                    height={height}
                    className="w-full h-full object-contain"
                    priority={priority}
                />
            </div>

            {/* White Theme Logo */}
            <div className="hidden [.white-theme_&]:block absolute inset-0">
                <Image
                    src="/collabologoblack.png"
                    alt="Collabo Logo"
                    width={width}
                    height={height}
                    className="w-full h-full object-contain"
                    priority={priority}
                />
            </div>

            {/* Default Logos (Blue/Dark) - Hide if pink or white theme is active */}
            <div className="[.pink-theme_&]:hidden [.white-theme_&]:hidden absolute inset-0">
                <Image
                    src="/collabologo.png"
                    alt="Collabo Logo"
                    width={width}
                    height={height}
                    className="w-full h-full object-contain dark:hidden"
                    priority={priority}
                />
                <Image
                    src="/collabologowhitenoback.png"
                    alt="Collabo Logo"
                    width={width}
                    height={height}
                    className="w-full h-full object-contain hidden dark:block"
                    priority={priority}
                />
            </div>

            {/* Placeholder to maintain dimensions if needed, or rely on absolute positioning wrapper */}
            {/* Since we use absolute positioning for smooth switching, we need a static element to define size if the wrapper doesn't have it. */}
            {/* Actually, let's keep it simple without absolute if possible, BUT absolute prevents layout shift if they differ slightly. */}
            {/* However, the simplest match to Sidebar is just conditional rendering. Let's try that to avoid complexity. */}
        </div>
    )
}

