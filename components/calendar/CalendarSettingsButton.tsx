"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Settings, PartyPopper } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { signIn } from "next-auth/react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/useLanguage"

export function CalendarSettingsButton() {
    const router = useRouter()
    const { } = useLanguage()
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [showHolidays, setShowHolidays] = useState(false)
    const [syncSettings, setSyncSettings] = useState<{
        isGoogleCalendarSyncEnabled: boolean;
        syncMode: string;
        syncedCalendarIds?: string[];
    }>({
        isGoogleCalendarSyncEnabled: false,
        syncMode: 'FULL_DETAILS',
        syncedCalendarIds: []
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [availableCalendars, setAvailableCalendars] = useState<any[]>([])
    const [isGoogleLinked, setIsGoogleLinked] = useState(false)
    const [hasRefreshToken, setHasRefreshToken] = useState(false)

    // Load showHolidays from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('calendar-show-holidays')
        if (saved !== null) {
            setShowHolidays(saved === 'true')
        }
    }, [])

    // Fetch settings and linked status
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/calendar/settings')
                if (res.ok) {
                    const data = await res.json()
                    setSyncSettings({
                        isGoogleCalendarSyncEnabled: data.isGoogleCalendarSyncEnabled,
                        syncMode: data.syncMode || "FULL_DETAILS",
                        syncedCalendarIds: data.syncedCalendarIds || ["primary"]
                    })
                    setIsGoogleLinked(data.isGoogleLinked)
                    setHasRefreshToken(data.hasRefreshToken)
                    setAvailableCalendars(data.availableCalendars || [])
                }
            } catch (error) {
                console.error("Failed to fetch settings", error)
            }
        }
        fetchSettings()
    }, [])

    const handleConnectGoogle = async () => {
        toast.loading("Redirecting to Google for authorization...")
        await signIn('google', {
            callbackUrl: window.location.href,
            redirect: true,
        })
    }

    const handleUpdateSettings = async (updates: Partial<typeof syncSettings>) => {
        const newSettings = { ...syncSettings, ...updates }

        setSyncSettings(newSettings)

        if (updates.isGoogleCalendarSyncEnabled === false) {
            toast.success("Google Calendar sync disabled")
        }

        try {
            const res = await fetch('/api/calendar/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSettings)
            })

            if (!res.ok) throw new Error("Failed to update settings")

            if (updates.isGoogleCalendarSyncEnabled !== false) {
                toast.success("Settings updated")
            }

            if (updates.isGoogleCalendarSyncEnabled === true) {
                const loadingToast = toast.loading("Syncing with Google...")
                setTimeout(() => {
                    router.refresh()
                    toast.success("Synced successfully", { id: loadingToast })
                }, 1000)
            } else {
                router.refresh()
            }

        } catch (error) {
            console.error(error)
            toast.error("Failed to save settings")
            setSyncSettings(syncSettings)
        }
    }

    return (
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" className="shrink-0 h-14 w-14 p-0 [&_svg]:!size-6 md:[&_svg]:!size-10">
                    <Settings className="h-6 w-6 md:h-10 md:w-10 text-muted-foreground transition-colors hover:text-foreground" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Calendar Settings</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4 min-h-[400px]">
                    <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-1">
                            <Label className="text-base flex items-center gap-2">
                                <PartyPopper className="h-4 w-4" />
                                Show Holidays
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Show local holidays (Israel) on the calendar.
                            </p>
                        </div>
                        <Switch
                            checked={showHolidays}
                            onCheckedChange={(checked: boolean) => {
                                setShowHolidays(checked)
                                localStorage.setItem('calendar-show-holidays', checked.toString())
                                router.refresh()
                            }}
                        />
                    </div>
                    <div className="border-t" />

                    <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-1">
                            <Label className="text-base">Google Calendar Sync</Label>
                            <p className="text-sm text-muted-foreground">
                                Sync events from your Google Calendar.
                                {!syncSettings.isGoogleCalendarSyncEnabled && (
                                    <span className="block text-xs text-yellow-600 mt-1">
                                        Requires signing in with Google.
                                    </span>
                                )}
                            </p>
                        </div>
                        <Switch
                            checked={syncSettings.isGoogleCalendarSyncEnabled}
                            onCheckedChange={(checked: boolean) => {
                                if (checked) {
                                    if (isGoogleLinked && hasRefreshToken) {
                                        handleUpdateSettings({ isGoogleCalendarSyncEnabled: true })
                                    } else {
                                        handleConnectGoogle()
                                    }
                                } else {
                                    handleUpdateSettings({ isGoogleCalendarSyncEnabled: false })
                                }
                            }}
                        />
                    </div>

                    {syncSettings.isGoogleCalendarSyncEnabled && (
                        <>
                            <div className="space-y-2">
                                <Label>Synced Calendars</Label>
                                {availableCalendars.length > 0 ? (
                                    <div className="space-y-2 border rounded-md p-3 max-h-40 overflow-y-auto">
                                        {availableCalendars.map((cal) => (
                                            <div key={cal.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={cal.id}
                                                    checked={syncSettings.syncedCalendarIds?.includes(cal.id)}
                                                    onCheckedChange={(checked) => {
                                                        const currentIds = syncSettings.syncedCalendarIds || []
                                                        const newIds = checked
                                                            ? [...currentIds, cal.id]
                                                            : currentIds.filter(id => id !== cal.id)

                                                        setSyncSettings(prev => ({ ...prev, syncedCalendarIds: newIds }))
                                                        handleUpdateSettings({ syncedCalendarIds: newIds })
                                                    }}
                                                />
                                                <label
                                                    htmlFor={cal.id}
                                                    className="text-sm cursor-pointer select-none leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                    style={{ color: cal.foregroundColor }}
                                                >
                                                    {cal.summary} {cal.primary && <span className="text-xs text-muted-foreground ml-1">(Primary)</span>}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-foreground italic">
                                        {isGoogleLinked ? "Loading calendars..." : "Connect Google Calendar to see available calendars."}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

