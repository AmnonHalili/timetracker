"use client"

import { useState, useEffect, startTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Play, Square, MapPin, AlertCircle, CheckCircle2, XCircle } from "lucide-react"
import { format } from "date-fns"
import { getCurrentLocation, isWithinWorkArea, watchLocation, clearLocationWatch, type Location, type WorkLocation } from "@/lib/gps-utils"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AccessibilityButton } from "@/components/accessibility/AccessibilityButton"
import { useLanguage } from "@/lib/useLanguage"

interface TimePunchHeaderProps {
    workLocation: WorkLocation | null
    activeWorkday: {
        id: string
        workdayStartTime: Date | string
    } | null
    activeEntry: {
        startTime: Date | string
        breaks?: Array<{
            startTime: Date | string
            endTime: Date | string | null
        }>
    } | null
}

type LocationStatus = "verified" | "unavailable" | "outside_area" | "not_required" | "checking"

export function TimePunchHeader({ workLocation, activeWorkday, activeEntry }: TimePunchHeaderProps) {
    const router = useRouter()
    const { t, dir } = useLanguage()
    const [currentTime, setCurrentTime] = useState(new Date())
    const [locationStatus, setLocationStatus] = useState<LocationStatus>(
        workLocation ? "checking" : "not_required"
    )
    const [, setCurrentLocation] = useState<Location | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [showOutsideDialog, setShowOutsideDialog] = useState(false)
    const [watchId, setWatchId] = useState<number | null>(null)
    const [isOutsideArea, setIsOutsideArea] = useState(false)
    const [isWorking, setIsWorking] = useState(!!activeWorkday)
    const [workingSince, setWorkingSince] = useState<Date | null>(
        activeWorkday ? new Date(activeWorkday.workdayStartTime) : null
    )


    // Update current time every second
    useEffect(() => {
        const timeInterval = setInterval(() => {
            setCurrentTime(new Date())
        }, 1000)
        return () => clearInterval(timeInterval)
    }, [])





    // Update working state when activeWorkday changes
    useEffect(() => {
        setIsWorking(!!activeWorkday)
        setWorkingSince(activeWorkday ? new Date(activeWorkday.workdayStartTime) : null)
    }, [activeWorkday])

    // Check location when work location is set
    useEffect(() => {
        if (!workLocation) {
            setLocationStatus("not_required")
            return
        }

        const checkLocation = async () => {
            try {
                const location = await getCurrentLocation()
                setCurrentLocation(location)
                const withinArea = isWithinWorkArea(location, workLocation)
                setLocationStatus(withinArea ? "verified" : "outside_area")
                setIsOutsideArea(!withinArea)
            } catch (error) {
                console.error("Error getting location:", error)
                setLocationStatus("unavailable")
            }
        }

        checkLocation()

        // Watch location if working
        if (isWorking && workLocation) {
            const id = watchLocation(
                (location) => {
                    setCurrentLocation(location)
                    const withinArea = isWithinWorkArea(location, workLocation)
                    setIsOutsideArea(!withinArea)

                    if (!withinArea && !isOutsideArea) {
                        // Just left the area
                        setShowOutsideDialog(true)
                        setIsOutsideArea(true)
                        // Auto-mark as break
                        fetch("/api/time-entries/break", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                location,
                                reason: "left_work_area",
                            }),
                        }).catch(console.error)
                    } else if (withinArea && isOutsideArea) {
                        // Returned to area
                        setIsOutsideArea(false)
                        toast.success("You've returned to the work area")
                        // Resume work (end break)
                        fetch("/api/time-entries/break", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                        }).catch(console.error)
                    }
                },
                (error) => {
                    console.error("Location watch error:", error)
                    setLocationStatus("unavailable")
                }
            )
            setWatchId(id)
        }

        return () => {
            if (watchId !== null) {
                clearLocationWatch(watchId)
            }
        }
    }, [workLocation, isWorking, isOutsideArea, watchId])

    const handleStartDay = async () => {
        if (!workLocation) {
            // No location required - Optimistic update: update UI immediately
            const optimisticStartTime = new Date()
            setIsWorking(true)
            setWorkingSince(optimisticStartTime)
            setIsProcessing(true)

            // API call happens in background - doesn't block UI
            try {
                const response = await fetch("/api/workday", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "start",
                        location: null,
                    }),
                })

                if (!response.ok) {
                    const data = await response.json()
                    throw new Error(data.message || "Failed to start work session")
                }

                toast.success("Work session started!")
                // Use startTransition to avoid blocking UI
                startTransition(() => {
                    router.refresh()
                })
            } catch (error) {
                console.error("Error starting work session:", error)
                // Revert optimistic update on error
                setIsWorking(false)
                setWorkingSince(null)
                toast.error(error instanceof Error ? error.message : "Failed to start work session")
            } finally {
                setIsProcessing(false)
            }
            return
        }

        // Location required - check GPS first (this is necessary, can't be optimistic)
        setIsProcessing(true)
        try {
            const location = await getCurrentLocation()
            setCurrentLocation(location)
            const withinArea = isWithinWorkArea(location, workLocation)

            if (!withinArea) {
                setShowOutsideDialog(true)
                setIsProcessing(false)
                return
            }

            // Optimistic update: update UI immediately after location check
            const optimisticStartTime = new Date()
            setIsWorking(true)
            setWorkingSince(optimisticStartTime)
            setLocationStatus("verified")

            // API call happens in background
            const response = await fetch("/api/workday", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "start",
                    location: location,
                }),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.message || "Failed to start work session")
            }

            toast.success("Work session started!")
            // Use startTransition to avoid blocking UI
            startTransition(() => {
                router.refresh()
            })
        } catch (error) {
            console.error("Error getting location:", error)
            setLocationStatus("unavailable")

            // Optimistic update even if location failed
            const optimisticStartTime = new Date()
            setIsWorking(true)
            setWorkingSince(optimisticStartTime)

            // Allow start but flag as unavailable
            const response = await fetch("/api/workday", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "start",
                    location: null,
                }),
            })

            if (response.ok) {
                toast.warning("Location unavailable, but work session started")
                startTransition(() => {
                    router.refresh()
                })
            } else {
                // Revert optimistic update on error
                setIsWorking(false)
                setWorkingSince(null)
                toast.error("Failed to start work session")
            }
        } finally {
            setIsProcessing(false)
        }
    }

    const handleEndDay = async () => {
        // Optimistic update: update UI immediately
        setIsWorking(false)
        setWorkingSince(null)
        setIsProcessing(true)

        // API call happens in background
        try {
            let location: Location | undefined
            if (workLocation) {
                try {
                    location = await getCurrentLocation()
                } catch (error) {
                    // Location unavailable, but allow ending
                    console.error("Error getting location for end:", error)
                }
            }

            const response = await fetch("/api/workday", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "end",
                    location: location || null,
                }),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.message || "Failed to end work session")
            }

            toast.success("Work session ended!")
            // Use startTransition to avoid blocking UI
            startTransition(() => {
                router.refresh()
            })
        } catch (error) {
            console.error("Error ending work session:", error)
            // Revert optimistic update on error - but we need to check if there's still an active entry
            // For now, just refresh to get the actual state
            startTransition(() => {
                router.refresh()
            })
            toast.error(error instanceof Error ? error.message : "Failed to end work session")
        } finally {
            setIsProcessing(false)
        }
    }

    const getLocationStatusIcon = () => {
        switch (locationStatus) {
            case "verified":
                return <CheckCircle2 className="h-4 w-4 text-green-500" />
            case "unavailable":
                return <AlertCircle className="h-4 w-4 text-yellow-500" />
            case "outside_area":
                return <XCircle className="h-4 w-4 text-red-500" />
            case "not_required":
                return <MapPin className="h-4 w-4 text-blue-500" />
            case "checking":
                return <AlertCircle className="h-4 w-4 text-gray-400 animate-pulse" />
            default:
                return null
        }
    }

    const getLocationStatusText = () => {
        switch (locationStatus) {
            case "verified":
                return "Location verified"
            case "unavailable":
                return "Location unavailable"
            case "outside_area":
                return "Outside work area"
            case "not_required":
                return "Location not required"
            case "checking":
                return "Checking location..."
            default:
                return ""
        }
    }

    const getWorkingDuration = () => {
        if (!workingSince) return ""
        const diff = currentTime.getTime() - workingSince.getTime()
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        return `${hours}h ${minutes}m`
    }

    return (
        <>
            {/* Mobile View - Timer at Top (Fixed), Button at Bottom (Fixed) */}
            {/* Task Timer Display - Mobile (fixed at top) */}
            {/* Mobile View - Timer at Top (Fixed) REMOVED */}

            <div className={`flex flex-col md:hidden gap-2 mb-1 ${activeEntry ? 'pt-[96px]' : ''}`}>
                {/* Location Status - Mobile */}
                {workLocation && (
                    <div className="flex items-center justify-center gap-2 text-sm">
                        {getLocationStatusIcon()}
                        <span className={`
                            ${locationStatus === "verified" ? "text-green-600" : ""}
                            ${locationStatus === "unavailable" ? "text-yellow-600" : ""}
                            ${locationStatus === "outside_area" ? "text-red-600" : ""}
                            ${locationStatus === "not_required" ? "text-blue-600" : ""}
                        `}>
                            {getLocationStatusText()}
                        </span>
                    </div>
                )}

                {/* Warning if outside area - Mobile */}
                {workLocation && locationStatus === "outside_area" && !isWorking && (
                    <div className="text-center text-sm text-red-600">
                        You must be within {workLocation.radius}m of the work location to start your day.
                    </div>
                )}
            </div>

            {/* Mobile Fixed Button at Bottom */}
            <div className="fixed bottom-4 left-0 right-0 z-40 md:hidden">
                <div className="px-4 pt-4 pb-4 bg-white dark:bg-background border border-border rounded-2xl shadow-lg mx-4">
                    <Button
                        onClick={isWorking ? handleEndDay : handleStartDay}
                        disabled={(isProcessing || (workLocation && locationStatus === "outside_area" && !isWorking)) || undefined}
                        size="lg"
                        className={`
                            w-full h-12 text-lg font-bold rounded-full
                        shadow-lg active:scale-[0.98] transition-all duration-200
                            border-0 mb-3
                        ${isWorking
                                ? "bg-red-500 hover:bg-red-600 text-white"
                                : "bg-primary hover:bg-primary/90 text-primary-foreground"
                            }
                        ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}
                    `}
                    >
                        {isWorking ? (
                            <>
                                <Square className="mr-2 h-5 w-5" />
                                {t('dashboard.endDay')}
                            </>
                        ) : (
                            <>
                                {isProcessing ? (
                                    <div className="flex items-center gap-2">
                                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        {t('dashboard.processing')}
                                    </div>
                                ) : (
                                    <>
                                        <Play className="mr-2 h-5 w-5" />
                                        {t('dashboard.startDay')}
                                    </>
                                )}
                            </>
                        )}
                    </Button>

                    {/* Working since - Mobile (Below Button) */}
                    {isWorking && workingSince && (
                        <div className="text-center text-sm">
                            <span className="text-muted-foreground">Working since </span>
                            <span className="font-semibold">
                                {format(workingSince, "HH:mm")} ({getWorkingDuration()})
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Accessibility Button - Above Main Button (Fixed) */}
            <div className="fixed bottom-[112px] right-4 z-50 md:hidden transition-all duration-200">
                <AccessibilityButton className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-shadow" />
            </div>

            {/* Desktop View - Original Layout with Card */}
            <Card className="hidden md:block w-full mb-6">
                <CardContent className="p-6">
                    <div className="flex flex-row items-center justify-between gap-4">
                        {/* Time and Status */}
                        <div className={`flex-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                            <div className="text-3xl font-bold mb-1">{format(currentTime, "HH:mm:ss")}</div>
                            <div className="text-sm text-muted-foreground mb-2">{format(currentTime, "EEEE, MMMM d, yyyy")}</div>
                            {isWorking && workingSince && (
                                <div className="text-sm">
                                    <span className="text-muted-foreground">Working since </span>
                                    <span className="font-semibold">
                                        {format(workingSince, "HH:mm")} ({getWorkingDuration()})
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Location Status */}
                        {workLocation && (
                            <div className="flex items-center gap-2 text-sm">
                                {getLocationStatusIcon()}
                                <span className={`
                                    ${locationStatus === "verified" ? "text-green-600" : ""}
                                    ${locationStatus === "unavailable" ? "text-yellow-600" : ""}
                                    ${locationStatus === "outside_area" ? "text-red-600" : ""}
                                    ${locationStatus === "not_required" ? "text-blue-600" : ""}
                                `}>
                                    {getLocationStatusText()}
                                </span>
                            </div>
                        )}

                        {/* Action Button */}
                        <Button
                            onClick={isWorking ? handleEndDay : handleStartDay}
                            disabled={(isProcessing || (workLocation && locationStatus === "outside_area" && !isWorking)) || undefined}
                            size="lg"
                            className={`
                                min-w-[140px] h-12 text-base font-bold
                                ${isWorking
                                    ? "bg-red-600 hover:bg-red-700 text-white"
                                    : "bg-primary hover:bg-primary/90 text-primary-foreground"
                                }
                                transition-all duration-200
                                ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}
                            `}
                        >
                            {isWorking ? (
                                <>
                                    <Square className="mr-2 h-5 w-5" />
                                    {t('dashboard.endDay')}
                                </>
                            ) : (
                                <>
                                    {isProcessing ? (
                                        <div className="flex items-center gap-2">
                                            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            {t('dashboard.processing')}
                                        </div>
                                    ) : (
                                        <>
                                            <Play className="mr-2 h-5 w-5" />
                                            {t('dashboard.startDay')}
                                        </>
                                    )}
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Warning if outside area - Desktop */}
                    {workLocation && locationStatus === "outside_area" && !isWorking && (
                        <div className="hidden md:block text-center text-sm text-red-600 mt-3">
                            You must be within {workLocation.radius}m of the work location to start your day.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Dialog for outside area */}
            <AlertDialog open={showOutsideDialog} onOpenChange={setShowOutsideDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Outside Work Area</AlertDialogTitle>
                        <AlertDialogDescription>
                            You are outside the allowed work area ({workLocation?.radius}m radius).
                            {isWorking
                                ? " Your work session will be marked as a break until you return."
                                : " You must be within the work area to start your day."
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>OK</AlertDialogCancel>
                        {isWorking && (
                            <AlertDialogAction onClick={handleEndDay}>
                                {t('dashboard.endDay')}
                            </AlertDialogAction>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

