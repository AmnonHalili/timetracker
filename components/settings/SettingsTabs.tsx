"use client"

import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLanguage } from "@/lib/useLanguage"

export function SettingsTabs({ userRole, hasProject }: { userRole: string, hasProject: boolean }) {
    const { t, dir } = useLanguage()

    return (
        <TabsList className="w-full justify-start h-auto p-1 bg-muted/50 rounded-lg overflow-x-auto" dir={dir}>
            <TabsTrigger value="profile" className="flex-1 min-w-[100px]">{t('settings.profile')}</TabsTrigger>
            <TabsTrigger value="language" className="flex-1 min-w-[100px]">{t('settings.language')}</TabsTrigger>
            <TabsTrigger value="security" className="flex-1 min-w-[100px]">{t('settings.security')}</TabsTrigger>
            <TabsTrigger value="appearance" className="flex-1 min-w-[100px]">{t('settings.appearance')}</TabsTrigger>
            <TabsTrigger value="notifications" className="flex-1 min-w-[100px]">{t('settings.notifications')}</TabsTrigger>
            {userRole === "ADMIN" && hasProject && (
                <TabsTrigger value="workspace" className="flex-1 min-w-[100px]">{t('settings.workspace')}</TabsTrigger>
            )}
        </TabsList>
    )
}

