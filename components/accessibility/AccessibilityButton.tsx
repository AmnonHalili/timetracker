"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Accessibility, Type, Eye, Zap } from "lucide-react"

type AccessibilityPreferences = {
    fontSize: 'normal' | 'large' | 'xlarge'
    highContrast: boolean
    reduceMotion: boolean
}

export function AccessibilityButton() {
    const [open, setOpen] = useState(false)
    const [preferences, setPreferences] = useState<AccessibilityPreferences>({
        fontSize: 'normal',
        highContrast: false,
        reduceMotion: false,
    })

    // Apply preferences to the document
    const applyPreferences = (prefs: AccessibilityPreferences) => {
        const root = document.documentElement
        
        // Font size
        root.classList.remove('font-size-normal', 'font-size-large', 'font-size-xlarge')
        root.classList.add(`font-size-${prefs.fontSize}`)
        
        // High contrast
        if (prefs.highContrast) {
            root.classList.add('high-contrast')
        } else {
            root.classList.remove('high-contrast')
        }
        
        // Reduce motion
        if (prefs.reduceMotion) {
            root.classList.add('reduce-motion')
        } else {
            root.classList.remove('reduce-motion')
        }
    }

    // Load preferences from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('accessibility-preferences')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                setPreferences(parsed)
                applyPreferences(parsed)
            } catch {
                // Ignore parse errors
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Save and apply preferences
    const updatePreference = <K extends keyof AccessibilityPreferences>(
        key: K,
        value: AccessibilityPreferences[K]
    ) => {
        const newPrefs = { ...preferences, [key]: value }
        setPreferences(newPrefs)
        localStorage.setItem('accessibility-preferences', JSON.stringify(newPrefs))
        applyPreferences(newPrefs)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-shadow"
                    aria-label="Accessibility options"
                >
                    <Accessibility className="h-5 w-5" aria-hidden="true" />
                </Button>
            </PopoverTrigger>
            <PopoverContent 
                className="w-80 p-4" 
                align="end"
                side="top"
            >
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Accessibility className="h-5 w-5 text-primary" aria-hidden="true" />
                        <h3 className="font-semibold text-lg">Accessibility</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Customize your viewing experience
                    </p>

                    <Separator />

                    {/* Font Size */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Type className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            <Label htmlFor="font-size" className="text-sm font-medium">
                                Text Size
                            </Label>
                        </div>
                        <div className="flex gap-2">
                            {(['normal', 'large', 'xlarge'] as const).map((size) => (
                                <Button
                                    key={size}
                                    id={`font-size-${size}`}
                                    variant={preferences.fontSize === size ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => updatePreference('fontSize', size)}
                                    className="flex-1 capitalize"
                                    aria-pressed={preferences.fontSize === size}
                                >
                                    {size === 'normal' ? 'Normal' : size === 'large' ? 'Large' : 'Extra Large'}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <Separator />

                    {/* High Contrast */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Eye className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                <Label htmlFor="high-contrast" className="text-sm font-medium">
                                    High Contrast
                                </Label>
                            </div>
                            <Button
                                id="high-contrast"
                                variant={preferences.highContrast ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => updatePreference('highContrast', !preferences.highContrast)}
                                aria-pressed={preferences.highContrast}
                            >
                                {preferences.highContrast ? 'On' : 'Off'}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Increase contrast for better visibility
                        </p>
                    </div>

                    <Separator />

                    {/* Reduce Motion */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                <Label htmlFor="reduce-motion" className="text-sm font-medium">
                                    Reduce Motion
                                </Label>
                            </div>
                            <Button
                                id="reduce-motion"
                                variant={preferences.reduceMotion ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => updatePreference('reduceMotion', !preferences.reduceMotion)}
                                aria-pressed={preferences.reduceMotion}
                            >
                                {preferences.reduceMotion ? 'On' : 'Off'}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Minimize animations and transitions
                        </p>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

