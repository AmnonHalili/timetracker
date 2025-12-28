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
        <div className="grid gap-4 md:grid-cols-2">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t('reports.totalWorked')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatHoursMinutes(totalWorked)}</div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t('reports.targetHours')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {(hasDailyTarget && totalTarget !== null && totalTarget > 0)
                            ? formatHoursMinutes(totalTarget)
                            : t('reports.none')}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

