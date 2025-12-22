"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Play, Square, Timer as TimerIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface TimerProps {
    activeEntry: {
        startTime: Date | string
        breaks?: Array<{
            startTime: Date | string
            endTime: Date | string | null
        }>
    } | null
}

export function Timer({ activeEntry }: TimerProps) {
    const router = useRouter()
    const [elapsed, setElapsed] = useState(0)
    const [loading, setLoading] = useState(false)

    console.log("Timer: activeEntry", activeEntry)

    // Calculate elapsed time locally every second
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

            // If paused, elapsed time shouldn't tick up, but this formula handles it naturally
            // (now increases, but break duration also increases by same amount)
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
            router.refresh() // Sync server components
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className={`border-2 ${activeEntry ? 'border-primary/50' : ''}`}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <TimerIcon className="h-5 w-5" />
                    Time Tracker
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6">
                <div className="text-6xl font-mono font-bold tracking-wider">
                    {formatTime(elapsed)}
                </div>

                <div className="flex gap-4 w-full">
                    {!activeEntry ? (
                        <Button
                            size="lg"
                            className="w-full bg-green-600 hover:bg-green-700 h-16 text-lg"
                            onClick={() => handleAction('start')}
                            disabled={loading}
                        >
                            {loading ? "Starting..." : <><Play className="mr-2 h-6 w-6" /> Start Working</>}
                        </Button>
                    ) : (
                        <div className="flex gap-4 w-full">
                            {isPaused ? (
                                <Button
                                    size="lg"
                                    className="w-full bg-blue-600 hover:bg-blue-700 h-16 text-lg"
                                    onClick={() => handleAction('resume')}
                                    disabled={loading}
                                >
                                    <Play className="mr-2 h-6 w-6" /> Resume
                                </Button>
                            ) : (
                                <Button
                                    size="lg"
                                    className="w-full bg-yellow-600 hover:bg-yellow-700 h-16 text-lg"
                                    onClick={() => handleAction('pause')}
                                    disabled={loading}
                                >
                                    <Square className="mr-2 h-6 w-6" /> Pause
                                </Button>
                            )}
                            <Button
                                size="lg"
                                variant="destructive"
                                className="w-full h-16 text-lg"
                                onClick={() => handleAction('stop')}
                                disabled={loading}
                            >
                                <Square className="mr-2 h-6 w-6" /> Stop Timer
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
