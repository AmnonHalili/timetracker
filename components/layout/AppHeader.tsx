"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { NotificationBell } from "@/components/layout/NotificationBell"
import { MobileSidebar } from "@/components/layout/MobileSidebar"
import { TeamStatusButton } from "@/components/dashboard/TeamStatusButton"
import { CalendarSettingsButton } from "@/components/calendar/CalendarSettingsButton"
import { useLanguage } from "@/lib/useLanguage"

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
    const pathname = usePathname()
    const [teamStatus, setTeamStatus] = useState<TeamMemberStatus[]>([])
    const isCalendarPage = pathname === '/calendar'

    useEffect(() => {
        fetch('/api/team-status')
            .then(res => res.json())
            .then(data => setTeamStatus(data))
            .catch(() => setTeamStatus([]))
    }, [])

    return (
        <div className="flex items-center justify-between px-4 md:px-8 py-2 bg-background/95 backdrop-blur sticky top-0 z-50 gap-2">
            <div className="flex items-center gap-2">
                <div className="md:hidden">
                    <MobileSidebar />
                </div>
                {isCalendarPage && (
                    <CalendarSettingsButton />
                )}
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

