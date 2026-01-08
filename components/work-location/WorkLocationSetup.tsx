"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, Navigation, Loader2, X } from "lucide-react"
import { toast } from "sonner"

interface WorkLocationSetupProps {
    onSave: (location: {
        latitude: number
        longitude: number
        radius: number
        address?: string
    } | null) => void
    onSkip?: () => void
    initialLocation?: {
        latitude: number
        longitude: number
        radius: number
        address?: string
    } | null
    isOptional?: boolean
}

export function WorkLocationSetup({ onSave, onSkip, initialLocation, isOptional = true }: WorkLocationSetupProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [isGettingLocation, setIsGettingLocation] = useState(false)
    const [latitude, setLatitude] = useState<number | null>(initialLocation?.latitude || null)
    const [longitude, setLongitude] = useState<number | null>(initialLocation?.longitude || null)
    const [radius, setRadius] = useState<number>(initialLocation?.radius || 150)
    const [address, setAddress] = useState<string>(initialLocation?.address || "")
    const [mode, setMode] = useState<'current'>('current')

    // Get current location
    const getCurrentLocation = () => {
        setIsGettingLocation(true)
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser")
            setIsGettingLocation(false)
            return
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLatitude(position.coords.latitude)
                setLongitude(position.coords.longitude)
                setIsGettingLocation(false)
                toast.success("Location captured successfully")

                // Try to reverse geocode to get address
                fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${position.coords.longitude},${position.coords.latitude}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.features && data.features.length > 0) {
                            setAddress(data.features[0].place_name)
                        }
                    })
                    .catch(() => {
                        // If mapbox is not configured, that's okay
                    })
            },
            (error) => {
                console.error("Error getting location:", error)
                toast.error("Failed to get your location. Please try again or enter manually.")
                setIsGettingLocation(false)
            }
        )
    }

    useEffect(() => {
        if (mode === 'current' && !latitude && !longitude) {
            getCurrentLocation()
        }
    }, [mode, latitude, longitude])

    const handleSave = () => {
        if (!latitude || !longitude) {
            toast.error("Please set a location first")
            return
        }

        if (radius < 50 || radius > 300) {
            toast.error("Radius must be between 50 and 300 meters")
            return
        }

        setIsLoading(true)
        onSave({
            latitude,
            longitude,
            radius,
            address: address || undefined
        })
        setIsLoading(false)
    }

    const handleRemove = () => {
        setLatitude(null)
        setLongitude(null)
        setAddress("")
        onSave(null)
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    {isOptional ? "Set Work Location (Optional)" : "Set Work Location"}
                </CardTitle>
                <CardDescription>
                    Define a work location for GPS verification. Members will need to be within this area to start their work day.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Location Mode Selection */}
                <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                        <Label>Location Method</Label>
                        <div className="flex flex-col gap-2">
                            <Button
                                type="button"
                                variant={mode === 'current' ? 'default' : 'outline'}
                                onClick={() => {
                                    setMode('current')
                                    if (!latitude || !longitude) {
                                        getCurrentLocation()
                                    }
                                }}
                                className="w-full justify-start"
                            >
                                <Navigation className="mr-2 h-4 w-4" />
                                Use my current location
                            </Button>
                        </div>
                    </div>


                    {/* Current Location Status */}
                    {mode === 'current' && (
                        <div className="space-y-2">
                            {isGettingLocation ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Getting your location...
                                </div>
                            ) : latitude && longitude ? (
                                <div className="rounded-lg border p-3 bg-muted/50">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="text-sm font-medium">Location captured</div>
                                            <div className="text-xs text-muted-foreground">
                                                {latitude.toFixed(6)}, {longitude.toFixed(6)}
                                            </div>
                                            {address && (
                                                <div className="text-xs text-muted-foreground">{address}</div>
                                            )}
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={getCurrentLocation}
                                        >
                                            Refresh
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={getCurrentLocation}
                                    disabled={isGettingLocation}
                                >
                                    {isGettingLocation ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Getting location...
                                        </>
                                    ) : (
                                        <>
                                            <Navigation className="mr-2 h-4 w-4" />
                                            Get Current Location
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* Radius Setting */}
                {latitude && longitude && (
                    <div className="space-y-2">
                        <Label htmlFor="radius">
                            Allowed Radius: {radius}m
                        </Label>
                        <Input
                            id="radius"
                            type="range"
                            min="50"
                            max="300"
                            step="10"
                            value={radius}
                            onChange={(e) => setRadius(Number(e.target.value))}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>50m</span>
                            <span>150m (default)</span>
                            <span>300m</span>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                    {latitude && longitude ? (
                        <>
                            <Button
                                onClick={handleSave}
                                disabled={isLoading}
                                className="flex-1"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    initialLocation ? "Update Location" : "Save Location"
                                )}
                            </Button>
                            {initialLocation && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={handleRemove}
                                    disabled={isLoading}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </>
                    ) : (
                        <Button
                            onClick={handleSave}
                            disabled={true}
                            className="flex-1"
                        >
                            Set Location First
                        </Button>
                    )}
                    {isOptional && onSkip && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onSkip}
                            disabled={isLoading}
                        >
                            Skip
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

