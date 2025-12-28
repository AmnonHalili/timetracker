"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ModeToggle } from "@/components/ui/mode-toggle"
import { Label } from "@/components/ui/label"
import { useLanguage } from "@/lib/useLanguage"

export function AppearanceForm() {
    const { t } = useLanguage()
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('appearance.title')}</CardTitle>
                <CardDescription>
                    {t('appearance.description')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <Label>{t('appearance.theme')}</Label>
                        <p className="text-sm text-muted-foreground">
                            {t('appearance.selectTheme')}
                        </p>
                    </div>
                    <ModeToggle />
                </div>
            </CardContent>
        </Card>
    )
}
