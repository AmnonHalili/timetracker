"use client"

import { useState } from "react"
import { WorkLocationSetup } from "@/components/work-location/WorkLocationSetup"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MapPin } from "lucide-react"
import { useLanguage } from "@/lib/useLanguage"

interface WorkLocationFormProps {
    projectId: string
    initialLocation?: {
        latitude: number
        longitude: number
        radius: number
        address?: string
    } | null
    initialIsRemoteWork?: boolean
}

export function WorkLocationForm({ projectId, initialLocation, initialIsRemoteWork = false }: WorkLocationFormProps) {
    const router = useRouter()
    const { t } = useLanguage()
    const [isSaving, setIsSaving] = useState(false)
    const [isRemoteWork, setIsRemoteWork] = useState(initialIsRemoteWork)

    const handleSave = async (location: {
        latitude: number
        longitude: number
        radius: number
        address?: string
    } | null) => {
        setIsSaving(true)
        try {
            const response = await fetch(`/api/projects/${projectId}/work-location`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    location,
                    isRemoteWork,
                }),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.message || "Failed to save work location")
            }

            toast.success(isRemoteWork ? t('workspace.remoteWorkEnabled') : (location ? "Work location saved successfully" : "Work location removed"))
            router.refresh()
        } catch (error) {
            console.error("Error saving work location:", error)
            toast.error(error instanceof Error ? error.message : "Failed to save work location")
        } finally {
            setIsSaving(false)
        }
    }

    const handleRemoteWorkToggle = async (remote: boolean) => {
        setIsRemoteWork(remote)
        setIsSaving(true)
        try {
            const response = await fetch(`/api/projects/${projectId}/work-location`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    location: remote ? null : initialLocation,
                    isRemoteWork: remote,
                }),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.message || "Failed to update work location settings")
            }

            toast.success(remote ? t('workspace.remoteWorkEnabled') : t('workspace.remoteWorkDisabled'))
            router.refresh()
        } catch (error) {
            console.error("Error updating remote work setting:", error)
            toast.error(error instanceof Error ? error.message : "Failed to update settings")
            setIsRemoteWork(!remote) // Revert on error
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Work Location
                </CardTitle>
                <CardDescription>
                    Configure work location settings. Choose between remote work (no location verification) or location-based work (GPS verification required).
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Remote Work Option */}
                <div className="space-y-2">
                    <Label className="text-base font-semibold">{t('workspace.workMode')}</Label>
                    <div className="space-y-2">
                        <div
                            className={`p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-primary/50 ${
                                isRemoteWork
                                    ? "border-primary bg-primary/5"
                                    : "border-muted"
                            }`}
                            onClick={() => !isSaving && handleRemoteWorkToggle(true)}
                        >
                            <div className="flex items-center gap-2">
                                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                                    isRemoteWork ? "border-primary bg-primary" : "border-muted-foreground"
                                }`}>
                                    {isRemoteWork && <div className="h-2 w-2 rounded-full bg-white" />}
                                </div>
                                <div>
                                    <div className="font-semibold">{t('workspace.remoteWork')}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {t('workspace.remoteWorkDescription')}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div
                            className={`p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-primary/50 ${
                                !isRemoteWork
                                    ? "border-primary bg-primary/5"
                                    : "border-muted"
                            }`}
                            onClick={() => !isSaving && handleRemoteWorkToggle(false)}
                        >
                            <div className="flex items-center gap-2">
                                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                                    !isRemoteWork ? "border-primary bg-primary" : "border-muted-foreground"
                                }`}>
                                    {!isRemoteWork && <div className="h-2 w-2 rounded-full bg-white" />}
                                </div>
                                <div>
                                    <div className="font-semibold">{t('workspace.locationBasedWork')}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {t('workspace.locationBasedWorkDescription')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Location Setup (only if not remote work) */}
                {!isRemoteWork && (
                    <WorkLocationSetup
                        onSave={handleSave}
                        initialLocation={initialLocation || null}
                        isOptional={true}
                    />
                )}
            </CardContent>
        </Card>
    )
}

