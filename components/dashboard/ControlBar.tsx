"use client"

import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

interface ControlBarProps {
    activeEntry: any | null
}

export function ControlBar({ activeEntry }: ControlBarProps) {
    const router = useRouter()
    const [elapsed, setElapsed] = useState(0)
    const [loading, setLoading] = useState(false)

    console.log("ControlBar: activeEntry", activeEntry)

    const isPaused = activeEntry?.breaks?.some((b: any) => !b.endTime)

    useEffect(() => {
        if (!activeEntry) {
            setElapsed(0)
            return
        }

        const calculate = () => {
            const now = new Date().getTime()
            const start = new Date(activeEntry.startTime).getTime()
            let totalBreakTime = 0

            activeEntry.breaks?.forEach((b: any) => {
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
        <div className="flex items-center justify-between bg-muted/30 p-4 rounded-md">
            <div className="text-xl font-mono font-medium text-muted-foreground ml-4">
                {formatTime(elapsed)}
            </div>

            {!activeEntry ? (
                <Button
                    variant="ghost"
                    className="hover:bg-transparent hover:text-primary font-medium"
                    onClick={() => handleAction('start')}
                    disabled={loading}
                >
                    Start Clock
                </Button>
            ) : (
                <div className="flex items-center gap-4">
                    {isPaused ? (
                        <Button
                            variant="ghost"
                            className="hover:bg-transparent text-primary hover:text-primary font-medium"
                            onClick={() => handleAction('resume')}
                            disabled={loading}
                        >
                            Resume
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            className="hover:bg-transparent text-primary hover:text-primary font-medium"
                            onClick={() => handleAction('pause')}
                            disabled={loading}
                        >
                            Pause
                        </Button>
                    )}
                    <div className="h-4 w-[1px] bg-muted-foreground/20" />
                    <Button
                        variant="ghost"
                        className="hover:bg-transparent text-destructive hover:text-destructive font-medium"
                        onClick={() => handleAction('stop')}
                        disabled={loading}
                    >
                        Stop Clock
                    </Button>
                </div>
            )}
        </div>
    )
}
