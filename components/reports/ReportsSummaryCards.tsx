"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatHoursMinutes } from "@/lib/utils"
import { useLanguage } from "@/lib/useLanguage"

interface ReportsSummaryCardsProps {
    totalWorked: number
    totalTarget: number | null
    hasDailyTarget: boolean
}

export function ReportsSummaryCards({ totalWorked, totalTarget, hasDailyTarget }: ReportsSummaryCardsProps) {
    const { t } = useLanguage()
    
    return (
        <div className="grid gap-3 md:gap-4 md:grid-cols-2">
            <Card className="border-primary/20 bg-primary/5 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 md:px-6 pt-4 md:pt-6">
                    <CardTitle className="text-xs md:text-sm font-medium">{t('reports.totalWorked')}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                    <div className="text-xl md:text-2xl font-bold">{formatHoursMinutes(totalWorked)}</div>
                </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 md:px-6 pt-4 md:pt-6">
                    <CardTitle className="text-xs md:text-sm font-medium">{t('reports.targetHours')}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                    <div className="text-xl md:text-2xl font-bold">
                        {(hasDailyTarget && totalTarget !== null && totalTarget > 0)
                            ? formatHoursMinutes(totalTarget)
                            : t('reports.none')}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

