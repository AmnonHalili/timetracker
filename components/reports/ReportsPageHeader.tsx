"use client"

import { useLanguage } from "@/lib/useLanguage"

export function ReportsPageHeader() {
    const { t } = useLanguage()
    
    return (
        <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('reports.monthlyReports')}</h1>
            <p className="text-muted-foreground">{t('reports.viewDetailedHistory')}</p>
        </div>
    )
}

