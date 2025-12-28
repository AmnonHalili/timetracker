"use client"

import { useLanguage } from "@/lib/useLanguage"

export function SettingsHeader() {
    const { t, dir } = useLanguage()

    return (
        <div dir={dir}>
            <h1 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
            <p className="text-muted-foreground">{t('settings.manageAccount')}</p>
        </div>
    )
}

