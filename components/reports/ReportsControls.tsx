"use client"

import { useLanguage } from "@/lib/useLanguage"
import { MonthSelector } from "./MonthSelector"
import { UserSelector } from "./UserSelector"
import { ExportButton } from "./ExportButton"

interface ReportsControlsProps {
    projectUsers: { id: string; name: string | null; email: string }[]
    targetUserId: string
    currentYear: number
    currentMonth: number
}

export function ReportsControls({ projectUsers, targetUserId, currentYear, currentMonth }: ReportsControlsProps) {
    const { t } = useLanguage()
    
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                {projectUsers.length > 1 && (
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-muted-foreground">{t('reports.user')}</label>
                        <UserSelector currentUserId={targetUserId} users={projectUsers} />
                    </div>
                )}
                <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-muted-foreground">{t('reports.period')}</label>
                        <MonthSelector year={currentYear} month={currentMonth} />
                    </div>
                    <ExportButton userId={targetUserId} year={currentYear} month={currentMonth} />
                </div>
            </div>
        </div>
    )
}

