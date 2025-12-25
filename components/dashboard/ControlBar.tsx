"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { MultiSelect } from "@/components/ui/multi-select"

interface ControlBarProps {
    activeEntry: {
        startTime: Date | string
        breaks?: Array<{
            startTime: Date | string
            endTime: Date | string | null
        }>
        taskId?: string | null
        description?: string | null
        // Assuming activeEntry might now have a 'tasks' array based on the useEffect change
        tasks?: Array<{ id: string; title: string }>
    } | null
    tasks: Array<{ id: string; title: string }>
}

export function ControlBar({ activeEntry, tasks }: ControlBarProps) {
    const router = useRouter()
    const [elapsed, setElapsed] = useState(0)
    const [loading, setLoading] = useState(false)
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
    const [description, setDescription] = useState("")
    const [isManualMode, setIsManualMode] = useState(false)
    const [manualStart, setManualStart] = useState("")
    const [manualEnd, setManualEnd] = useState("")

    useEffect(() => {
        if (activeEntry?.description) {
            setDescription(activeEntry.description)
        } else if (!activeEntry) {
            setDescription("")
        }

        if (activeEntry?.tasks) {
            setSelectedTaskIds(activeEntry.tasks.map(t => t.id))
        } else if (!activeEntry) {
            setSelectedTaskIds([])
        }
    }, [activeEntry])


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
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} `
    }

    const handleStart = async () => {
        setLoading(true)
        try {
            if (isManualMode && manualStart && manualEnd) {
                // Manual Entry
                const start = new Date()
                const end = new Date()
                const [startH, startM] = manualStart.split(':')
                const [endH, endM] = manualEnd.split(':')

                start.setHours(parseInt(startH), parseInt(startM), 0, 0)
                end.setHours(parseInt(endH), parseInt(endM), 0, 0)

                await fetch('/api/time-entries', {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'manual',
                        manualData: { start, end, description },
                        taskIds: selectedTaskIds.length > 0 ? selectedTaskIds : undefined
                    }),
                })
                setManualStart("")
                setManualEnd("")
                setDescription("")
                setSelectedTaskIds([])
            } else {
                // Timer Start
                await fetch('/api/time-entries', {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'start',
                        description,
                        taskIds: selectedTaskIds.length > 0 ? selectedTaskIds : undefined
                    }),
                })
            }
            router.refresh()
        } catch (error) {
            console.error(error)
            alert("Failed to save entry")
        } finally {
            setLoading(false)
        }
    }

    const handleAction = async (action: 'stop' | 'pause' | 'resume') => {
        setLoading(true)
        try {
            await fetch('/api/time-entries', {
                method: 'POST',
                body: JSON.stringify({ action }),
            })
            if (action === 'stop') {
                setDescription("")
                setSelectedTaskIds([])
            }
            router.refresh()
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full">


            {/* Right Side: Unified Tracker */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-muted/30 p-3 rounded-xl">

                {/* Inputs Area */}
                <div className="flex flex-1 items-center gap-3 w-full">
                    <label htmlFor="work-description" className="sr-only">
                        What are you working on?
                    </label>
                    <Input
                        id="work-description"
                        placeholder="What are you working on?"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="bg-background border-input hover:bg-accent/50 focus:bg-background shadow-sm h-9 text-sm max-w-sm"
                        disabled={!!activeEntry}
                        aria-label="What are you working on?"
                    />

                    {/* Task Selector */}
                    <div className="w-[180px] shrink-0">
                        <MultiSelect
                            options={tasks.map(t => ({ label: t.title, value: t.id }))}
                            selected={selectedTaskIds}
                            onChange={setSelectedTaskIds}
                            placeholder="Tasks..."
                            className="bg-background border-input hover:bg-accent/50 text-sm h-9 shadow-sm"
                            maxCount={1}
                        />
                    </div>
                </div>

                {/* Controls Area */}
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">

                    {/* Timer / Manual Inputs */}
                    {!activeEntry && isManualMode ? (
                        <div className="flex items-center gap-2">
                            <label htmlFor="manual-start-time" className="sr-only">
                                Start time
                            </label>
                            <Input
                                id="manual-start-time"
                                type="time"
                                value={manualStart}
                                onChange={(e) => setManualStart(e.target.value)}
                                className="w-[95px] h-9 text-sm bg-background border-input shadow-sm"
                                aria-label="Start time"
                            />
                            <span className="text-muted-foreground" aria-hidden="true">-</span>
                            <label htmlFor="manual-end-time" className="sr-only">
                                End time
                            </label>
                            <Input
                                id="manual-end-time"
                                type="time"
                                value={manualEnd}
                                onChange={(e) => setManualEnd(e.target.value)}
                                className="w-[95px] h-9 text-sm bg-background border-input shadow-sm"
                                aria-label="End time"
                            />
                        </div>
                    ) : (
                        <div className="font-mono text-2xl font-bold text-primary tabular-nums tracking-wider px-2 min-w-[120px] text-center mr-6">
                            {formatTime(elapsed)}
                        </div>
                    )}


                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        {!activeEntry ? (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setIsManualMode(!isManualMode)}
                                    className={`h-9 px-3 text-xs font-medium border-dashed ${isManualMode ? 'bg-primary/10 text-primary border-primary/20' : 'text-muted-foreground border-border'}`}
                                >
                                    {isManualMode ? 'Timer' : 'Manual'}
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleStart}
                                    disabled={loading || (isManualMode && (!manualStart || !manualEnd))}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium min-w-[80px] h-9 shadow-sm"
                                >
                                    {isManualMode ? 'Add' : 'Start'}
                                </Button>
                            </>
                        ) : (
                            <>
                                {isPaused ? (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-primary text-primary hover:bg-primary/5 font-medium h-9 shadow-sm"
                                        onClick={() => handleAction('resume')}
                                        disabled={loading}
                                    >
                                        Resume
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-input hover:bg-accent text-accent-foreground font-medium h-9 shadow-sm"
                                        onClick={() => handleAction('pause')}
                                        disabled={loading}
                                    >
                                        Pause
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-medium h-9 shadow-sm"
                                    onClick={() => handleAction('stop')}
                                    disabled={loading}
                                >
                                    Stop
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
