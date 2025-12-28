"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Users } from "lucide-react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { TeamStatusWidget } from "./TeamStatusWidget"
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

interface TeamStatusButtonProps {
    teamStatus: TeamMemberStatus[]
}

export function TeamStatusButton({ teamStatus }: TeamStatusButtonProps) {
    const { t, isRTL } = useLanguage()
    const [open, setOpen] = useState(false)

    if (teamStatus.length === 0) {
        return null
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="relative h-14 w-14 p-0 [&_svg]:!size-6 md:[&_svg]:!size-10"
                    aria-label={t('team.liveTeamStatus')}
                >
                    <Users className="h-6 w-6 md:h-10 md:w-10 text-muted-foreground" aria-hidden="true" />
                </Button>
            </SheetTrigger>
            <SheetContent side={isRTL ? 'right' : 'left'} className="w-[90vw] sm:w-[400px] p-0">
                <SheetHeader className="p-4 border-b">
                    <SheetTitle>{t('team.liveTeamStatus')}</SheetTitle>
                </SheetHeader>
                <div className="p-4">
                    <TeamStatusWidget teamStatus={teamStatus} />
                </div>
            </SheetContent>
        </Sheet>
    )
}

