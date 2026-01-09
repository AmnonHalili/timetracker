"use client"

import { usePushNotifications } from "@/hooks/usePushNotifications"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, Loader2 } from "lucide-react"

export function NotificationForm() {
    const { isSubscribed, subscribeToPush, loading, error } = usePushNotifications()

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Push Notifications
                </CardTitle>
                <CardDescription>
                    Receive notifications about tasks, messages, and updates directly to your device.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                        <div className="font-medium">Device Notifications</div>
                        <div className="text-sm text-muted-foreground">
                            {isSubscribed
                                ? "This device is currently subscribed to notifications."
                                : "Enable push notifications for this device."}
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
                        {isSubscribed ? "Enabled" : "Enable"}
                    </Button>
                </div>
                {error && (
                    <p className="text-sm text-destructive">{error}</p>
                )}
            </CardContent>
        </Card>
    )
}
