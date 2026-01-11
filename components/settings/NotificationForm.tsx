"use client"

import { usePushNotifications } from "@/hooks/usePushNotifications"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, Loader2 } from "lucide-react"
import { useLanguage } from "@/lib/useLanguage"

export function NotificationForm() {
    const { t } = useLanguage()
    const { isSubscribed, subscribeToPush, loading, error } = usePushNotifications()

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    {t('settings.pushNotifications')}
                </CardTitle>
                <CardDescription>
                    {t('settings.pushNotificationsDescription')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                        <div className="font-medium">{t('settings.deviceNotifications')}</div>
                        <div className="text-sm text-muted-foreground">
                            {isSubscribed
                                ? t('settings.deviceSubscribed')
                                : t('settings.enablePushNotifications')}
                        </div>
                    </div>
                    <Button
                        onClick={subscribeToPush}
                        disabled={loading || isSubscribed}
                        variant={isSubscribed ? "outline" : "default"}
                    >
                        {loading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {isSubscribed ? t('settings.enabled') : t('settings.enable')}
                    </Button>
                </div>
                {error && (
                    <p className="text-sm text-destructive">{error}</p>
                )}
            </CardContent>
        </Card>
    )
}
