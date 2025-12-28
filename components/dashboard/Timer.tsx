"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Play, Square, Timer as TimerIcon } from "lucide-react"
import { useEffect, useState, startTransition } from "react"
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
    // Local state for optimistic updates
    const [optimisticEntry, setOptimisticEntry] = useState<TimerProps['activeEntry']>(activeEntry)
    const [elapsed, setElapsed] = useState(0)
    const [loading, setLoading] = useState(false)

    // Sync with server state when it arrives
    useEffect(() => {
        setOptimisticEntry(activeEntry)
    }, [activeEntry])

    // Calculate elapsed time locally every second
    const isPaused = optimisticEntry?.breaks?.some((b) => !b.endTime)

    useEffect(() => {
        if (!optimisticEntry) {
            setElapsed(0)
            return
        }

        const calculate = () => {
            const now = new Date().getTime()
            const start = new Date(optimisticEntry.startTime).getTime()
            let totalBreakTime = 0

            optimisticEntry.breaks?.forEach((b) => {
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
    }, [optimisticEntry])

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = seconds % 60
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    const handleAction = async (action: 'start' | 'stop' | 'pause' | 'resume') => {
        setLoading(true)

        // 1. Optimistic Update
        const now = new Date()
        const previousEntry = optimisticEntry // Backup for rollback

        if (action === 'start') {
            setOptimisticEntry({
                startTime: now,
                breaks: []
            })
        } else if (action === 'stop') {
            setOptimisticEntry(null)
        } else if (action === 'pause' && optimisticEntry) {
            setOptimisticEntry({
                ...optimisticEntry,
                breaks: [...(optimisticEntry.breaks || []), { startTime: now, endTime: null }]
            })
        } else if (action === 'resume' && optimisticEntry && optimisticEntry.breaks) {
            const newBreaks = [...optimisticEntry.breaks]
            const lastBreakIndex = newBreaks.findIndex(b => !b.endTime)
            if (lastBreakIndex >= 0) {
                newBreaks[lastBreakIndex] = { ...newBreaks[lastBreakIndex], endTime: now.toISOString() } // Use string to match typical serialization
                setOptimisticEntry({
                    ...optimisticEntry,
                    breaks: newBreaks
                })
            }
        }

        try {
            await fetch('/api/time-entries', {
                method: 'POST',
                body: JSON.stringify({ action }),
            })
            startTransition(() => {
                router.refresh() // Sync server components
            })
        } catch (error) {
            console.error("Timer action failed", error)
            // Revert on error
            setOptimisticEntry(previousEntry)
            alert("Failed to update timer. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className={`border-2 ${optimisticEntry ? 'border-primary/50' : ''}`}>
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
                    {!optimisticEntry ? (
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
