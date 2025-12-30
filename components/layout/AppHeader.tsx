"use client"

import { useEffect, useState } from "react"
import { NotificationBell } from "@/components/layout/NotificationBell"
import { MobileSidebar } from "@/components/layout/MobileSidebar"
import { TeamStatusButton } from "@/components/dashboard/TeamStatusButton"
import { useLanguage } from "@/lib/useLanguage"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

interface TeamMemberStatus {
    userId: string
    name: string | null
    email: string
    role: "ADMIN" | "EMPLOYEE"
    jobTitle: string | null
    status: 'WORKING' | 'BREAK' | 'OFFLINE'
    lastActive?: Date
}

export function AppHeader() {
    const { isRTL } = useLanguage()
    const { theme } = useTheme()
    const [teamStatus, setTeamStatus] = useState<TeamMemberStatus[]>([])
    const [mounted, setMounted] = useState(false)
    const [headerBg, setHeaderBg] = useState("bg-background/95")

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        fetch('/api/team-status')
            .then(res => res.json())
            .then(data => setTeamStatus(data))
            .catch(() => setTeamStatus([]))
    }, [])

    // Update header background color based on theme
    useEffect(() => {
        if (!mounted) return
        
        const checkTheme = () => {
            const currentTheme = theme || localStorage.getItem('theme') || localStorage.getItem('appTheme') || 'blue'
            
            // White background for blue, pink, or white themes
            if (currentTheme === 'blue' || currentTheme === 'pink' || currentTheme === 'white') {
                setHeaderBg("bg-white/95")
            }
            // Black background for black or system themes
            else if (currentTheme === 'black' || currentTheme === 'system') {
                setHeaderBg("bg-black/95")
            }
            // Default fallback
            else {
                setHeaderBg("bg-background/95")
            }
        }
        
        checkTheme()
        
        // Listen for theme changes
        const handleStorageChange = () => checkTheme()
        window.addEventListener('storage', handleStorageChange)
        
        // Also check on focus in case theme changed in another tab
        window.addEventListener('focus', checkTheme)
        
        // Watch for DOM class changes (theme changes)
        const observer = new MutationObserver(checkTheme)
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        })
        
        return () => {
            window.removeEventListener('storage', handleStorageChange)
            window.removeEventListener('focus', checkTheme)
            observer.disconnect()
        }
    }, [theme, mounted])

    return (
        <div className={cn("flex items-center justify-between px-4 md:px-8 py-2 backdrop-blur sticky top-0 z-10 gap-2", headerBg)}>
            <div className="md:hidden">
                <MobileSidebar />
            </div>
            {/* Mobile Logo (Centered) */}
            <div
                className="absolute left-1/2 -translate-x-1/2 md:hidden font-bold text-xl text-primary tracking-tight uppercase"
                style={{ fontFamily: "'Gotham', var(--font-montserrat), sans-serif" }}
            >
                COLLABO
            </div>
            <div className={`flex items-center gap-2 ${isRTL ? 'mr-auto' : 'ml-auto'}`}>
                {teamStatus.length > 0 && (
                    <div className="md:hidden">
                        <TeamStatusButton teamStatus={teamStatus} />
                    </div>
                )}
                <NotificationBell />
            </div>
        </div>
    )
}

