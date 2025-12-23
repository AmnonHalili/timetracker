"use client"

import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

interface ControlBarProps {
    activeEntry: {
        startTime: Date | string
        breaks?: Array<{
            startTime: Date | string
            endTime: Date | string | null
        }>
    } | null
    extraHours: number
    remainingHours: number
}

export function ControlBar({ activeEntry, extraHours, remainingHours }: ControlBarProps) {
    const router = useRouter()
    const [elapsed, setElapsed] = useState(0)
    const [loading, setLoading] = useState(false)

    console.log("ControlBar: activeEntry", activeEntry)

    const isPaused = activeEntry?.breaks?.some((b) => !b.endTime)

    useEffect(() => {
        if (!activeEntry) {
            setElapsed(0)
            return
        }

        const calculate = () => {
            const now = new Date().getTime()
            const start = new Date(activeEntry.startTime).getTime()
            let totalBreakTime = 0

            activeEntry.breaks?.forEach((b) => {
                const bStart = new Date(b.startTime).getTime()
                const bEnd = b.endTime ? new Date(b.endTime).getTime() : now
                totalBreakTime += (bEnd - bStart)
            })

            setElapsed(Math.max(0, Math.floor((now - start - totalBreakTime) / 1000)))
        }

        calculate()
        const interval = setInterval(calculate, 1000)
        return () => clearInterval(interval)
    }, [activeEntry])

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = seconds % 60
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    const handleAction = async (action: 'start' | 'stop' | 'pause' | 'resume') => {
        setLoading(true)
        try {
            await fetch('/api/time-entries', {
                method: 'POST',
                body: JSON.stringify({ action }),
            })
            router.refresh()
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Side: Stats */}
            <div className="flex items-center justify-between md:justify-start gap-6 bg-muted/30 p-4 rounded-xl">
                <div className="flex flex-row w-full md:w-auto justify-between md:justify-start gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Extra:</span>
                        <span className={extraHours >= 0 ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                            {extraHours > 0 ? '+' : ''}{extraHours.toFixed(2)}h
                        </span>
                    </div>
                    <div className="hidden md:block text-muted-foreground/20">|</div>
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Remaining:</span>
                        <span className="font-medium">
                            {remainingHours.toFixed(2)}h
                        </span>
                    </div>
                </div>
            </div>

            {/* Right Side: Timer & Controls */}
            <div className="flex items-center justify-between bg-muted/30 p-4 rounded-xl">
                <div className="text-3xl font-mono font-bold text-primary tracking-wider tabular-nums">
                    {formatTime(elapsed)}
                </div>

                <div className="flex items-center gap-4">
                    <div className="h-8 w-[1px] bg-border hidden sm:block" />

                    {!activeEntry ? (
                        <Button
                            size="sm"
                            onClick={() => handleAction('start')}
                            disabled={loading}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium min-w-[100px]"
                        >
                            Start
                        </Button>
                    ) : (
                        <div className="flex items-center gap-2">
                            {isPaused ? (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-primary text-primary hover:bg-primary/5 font-medium px-4"
                                    onClick={() => handleAction('resume')}
                                    disabled={loading}
                                >
                                    Resume
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-input hover:bg-accent text-accent-foreground font-medium px-4"
                                    onClick={() => handleAction('pause')}
                                    disabled={loading}
                                >
                                    Pause
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="destructive"
                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-medium px-4"
                                onClick={() => handleAction('stop')}
                                disabled={loading}
                            >
                                Stop
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
