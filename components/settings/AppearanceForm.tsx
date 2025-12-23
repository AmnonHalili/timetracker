"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ModeToggle } from "@/components/ui/mode-toggle"
import { Label } from "@/components/ui/label"

export function AppearanceForm() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                    Customize the look and feel of the application. Automatically switch between day and night themes.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <Label>Theme</Label>
                        <p className="text-sm text-muted-foreground">
                            Select the theme for the dashboard.
                        </p>
                    </div>
                    <ModeToggle />
                </div>
            </CardContent>
        </Card>
    )
}
