"use client"

import { useLanguage } from "@/lib/useLanguage"
import { MonthSelector } from "./MonthSelector"
import { UserSelector } from "./UserSelector"
import { ExportButton } from "./ExportButton"

interface ReportsControlsProps {
    projectUsers: { id: string; name: string | null; email: string }[]
    targetUserId: string
    loggedInUserId: string
    currentYear: number
    currentMonth: number
}

export function ReportsControls({ projectUsers, targetUserId, loggedInUserId, currentYear, currentMonth }: ReportsControlsProps) {
    const { t } = useLanguage()
    
    return (
        <div className="w-full md:w-auto">
            <div className="flex flex-col gap-4 md:gap-6">
                {projectUsers.length > 0 && (
                    <div className="flex flex-col gap-2 w-full md:w-auto">
                        <label className="text-xs md:text-sm font-medium text-muted-foreground">{t('reports.user')}</label>
                        <UserSelector currentUserId={targetUserId} loggedInUserId={loggedInUserId} users={projectUsers} />
                    </div>
                )}
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
                    <div className="flex flex-col gap-2 flex-1 md:flex-initial">
                        <label className="text-xs md:text-sm font-medium text-muted-foreground">{t('reports.period')}</label>
                        <MonthSelector year={currentYear} month={currentMonth} />
                    </div>
                    <div className="flex items-end">
                        <ExportButton userId={targetUserId} year={currentYear} month={currentMonth} projectUsers={projectUsers} />
                    </div>
                </div>
            </div>
        </div>
    )
}
