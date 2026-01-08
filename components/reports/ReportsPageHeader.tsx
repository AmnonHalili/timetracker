"use client"

import { useLanguage } from "@/lib/useLanguage"
import { BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"

export function ReportsPageHeader() {
    const { t, isRTL } = useLanguage()
    
    return (
        <div className="space-y-2 md:space-y-1">
            {/* Icon + Title - App-like design */}
            <div className={cn(
                "flex items-center gap-2.5 md:gap-3",
                isRTL && "flex-row-reverse"
            )}>
                <div className="p-2 rounded-xl bg-primary/10 dark:bg-primary/20 md:hidden">
                    <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                <h1 className="text-xl md:text-3xl font-semibold md:font-bold tracking-tight text-foreground">
                    {t('reports.monthlyReports')}
                </h1>
            </div>
            <p className="text-sm md:text-base text-muted-foreground">
                {t('reports.viewDetailedHistory')}
            </p>
        </div>
    )
}

