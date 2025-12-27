"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
        subtaskId?: string | null
    } | null
    tasks: Array<{ 
        id: string
        title: string
        subtasks?: Array<{ id: string; title: string; isDone: boolean }>
    }>
    onTimerStopped?: (stoppedEntry: {
        startTime: Date
        endTime: Date
        description?: string | null
        breaks?: Array<{ startTime: Date; endTime: Date | null }>
        tasks?: Array<{ id: string; title: string }>
        subtaskId?: string | null
    }) => void
}

export function ControlBar({ activeEntry, tasks, onTimerStopped }: ControlBarProps) {
    const router = useRouter()
    // Optimistic state for immediate UI updates
    const [optimisticEntry, setOptimisticEntry] = useState<ControlBarProps['activeEntry']>(activeEntry)
    const [elapsed, setElapsed] = useState(0)
    const [loading, setLoading] = useState(false)
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
    const [selectedSubtaskId, setSelectedSubtaskId] = useState<string | null>(null)
    const [description, setDescription] = useState("")
    const [isManualMode, setIsManualMode] = useState(false)
    const [manualStart, setManualStart] = useState("")
    const [manualEnd, setManualEnd] = useState("")
    const [isDataLoaded, setIsDataLoaded] = useState(!!activeEntry) // Track if server data has loaded - true if we already have activeEntry

    // Sync optimistic state with server state when it arrives
    // Preserve optimistic startTime to prevent jumping while allowing smooth updates
    useEffect(() => {
        if (activeEntry) {
            if (optimisticEntry) {
                const optimisticStart = new Date(optimisticEntry.startTime).getTime()
                const serverStart = new Date(activeEntry.startTime).getTime()
                const now = Date.now()

                // If we have an optimistic entry that was just created (within last 10 seconds)
                // and the server time is close (within 5 seconds), keep the optimistic startTime
                // This prevents jumping while still allowing the timer to start immediately
                const timeSinceOptimistic = now - optimisticStart
                const timeDiff = Math.abs(serverStart - optimisticStart)

                if (timeSinceOptimistic < 10000 && timeDiff < 5000) {
                    // Merge server data (tasks, description, breaks) but keep optimistic startTime
                    setOptimisticEntry({
                        ...activeEntry,
                        startTime: optimisticEntry.startTime,
                        // Preserve breaks from optimistic if they're more recent
                        breaks: optimisticEntry.breaks && optimisticEntry.breaks.length > 0
                            ? optimisticEntry.breaks
                            : activeEntry.breaks
                    })
                } else {
                    // Use server value if it's significantly different or optimistic is old
                    setOptimisticEntry(activeEntry)
                }
            } else {
                // No optimistic entry, use server value
                setOptimisticEntry(activeEntry)
            }
            // Mark data as loaded when server entry arrives
            setIsDataLoaded(true)
        } else {
            // Server says no active entry, clear optimistic state
            setOptimisticEntry(null)
            setIsDataLoaded(false)
        }
    }, [activeEntry, optimisticEntry])

    useEffect(() => {
        if (optimisticEntry?.description) {
            setDescription(optimisticEntry.description)
        } else if (!optimisticEntry) {
            setDescription("")
        }

        if (optimisticEntry?.tasks) {
            setSelectedTaskIds(optimisticEntry.tasks.map(t => t.id))
        } else if (!optimisticEntry) {
            setSelectedTaskIds([])
            setSelectedSubtaskId(null)
        }
        
        if (optimisticEntry?.subtaskId !== undefined) {
            setSelectedSubtaskId(optimisticEntry.subtaskId)
        } else if (!optimisticEntry) {
            setSelectedSubtaskId(null)
        }
    }, [optimisticEntry])


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

            setElapsed(Math.max(0, Math.floor((now - start - totalBreakTime) / 1000)))
        }

        // Calculate immediately for instant display
        calculate()
        const interval = setInterval(calculate, 1000)
        return () => clearInterval(interval)
    }, [optimisticEntry])

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = seconds % 60
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} `
    }

    const handleStart = async () => {
        // Optimistic update FIRST - timer starts immediately, no delay
        const now = new Date()
        const previousEntry = optimisticEntry // Backup for rollback

        // Reset data loaded flag - data needs to load before stop is allowed
        setIsDataLoaded(false)

        if (!isManualMode) {
            // Timer Start - update optimistically IMMEDIATELY
            setOptimisticEntry({
                startTime: now,
                breaks: [],
                description: description || null,
                tasks: selectedTaskIds.length > 0
                    ? tasks.filter(t => selectedTaskIds.includes(t.id))
                    : undefined,
                subtaskId: selectedSubtaskId || null
            })
        }

        setLoading(true)

        // API call happens in background - doesn't block UI
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
                        taskIds: selectedTaskIds.length > 0 ? selectedTaskIds : undefined,
                        subtaskId: selectedSubtaskId || null
                    }),
                })
                setManualStart("")
                setManualEnd("")
                setDescription("")
                setSelectedTaskIds([])
                setSelectedSubtaskId(null)
            } else {
                // Timer Start
                await fetch('/api/time-entries', {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'start',
                        description,
                        taskIds: selectedTaskIds.length > 0 ? selectedTaskIds : undefined,
                        subtaskId: selectedSubtaskId || null
                    }),
                })
            }
            router.refresh()
        } catch (error) {
            console.error(error)
            // Revert optimistic update on error
            setOptimisticEntry(previousEntry)
            alert("Failed to save entry")
        } finally {
            setLoading(false)
        }
    }

    const handleAction = async (action: 'stop' | 'pause' | 'resume') => {
        setLoading(true)

        // Optimistic updates for immediate UI feedback
        const now = new Date()
        const previousEntry = optimisticEntry // Backup for rollback

        if (action === 'stop') {
            // Create the stopped entry data for optimistic display
            if (optimisticEntry && onTimerStopped) {
                const stoppedEntry = {
                    startTime: new Date(optimisticEntry.startTime),
                    endTime: now,
                    description: optimisticEntry.description || null,
                    breaks: optimisticEntry.breaks?.map(b => ({
                        startTime: new Date(b.startTime),
                        endTime: b.endTime ? new Date(b.endTime) : null
                    })) || [],
                    tasks: optimisticEntry.tasks || [],
                    subtaskId: optimisticEntry.subtaskId || null
                }
                onTimerStopped(stoppedEntry)
            }

            setOptimisticEntry(null)
            setDescription("")
            setSelectedTaskIds([])
            setSelectedSubtaskId(null)
        } else if (action === 'pause' && optimisticEntry) {
            setOptimisticEntry({
                ...optimisticEntry,
                breaks: [...(optimisticEntry.breaks || []), { startTime: now, endTime: null }]
            })
        } else if (action === 'resume' && optimisticEntry && optimisticEntry.breaks) {
            const newBreaks = [...optimisticEntry.breaks]
            const lastBreakIndex = newBreaks.findIndex(b => !b.endTime)
            if (lastBreakIndex >= 0) {
                newBreaks[lastBreakIndex] = { ...newBreaks[lastBreakIndex], endTime: now.toISOString() }
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
            router.refresh()
        } catch (error) {
            console.error("Timer action failed", error)
            // Revert optimistic update on error
            setOptimisticEntry(previousEntry)
            alert("Failed to update timer. Please try again.")
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
                        disabled={!!optimisticEntry}
                        aria-label="What are you working on?"
                    />

                    {/* Task Selector */}
                    <div className="w-[180px] shrink-0">
                        <Select
                            value={selectedTaskIds.length > 0 ? selectedTaskIds[0] : undefined}
                            onValueChange={(value) => {
                                setSelectedTaskIds(value ? [value] : [])
                                // Clear subtask selection when task changes
                                setSelectedSubtaskId(null)
                            }}
                            disabled={!!optimisticEntry}
                        >
                            <SelectTrigger className="bg-background border-input hover:bg-accent/50 text-sm h-9 shadow-sm">
                                <SelectValue placeholder="Tasks..." />
                            </SelectTrigger>
                            <SelectContent>
                                {tasks.map((task) => (
                                    <SelectItem key={task.id} value={task.id}>
                                        {task.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Subtask Selector - Only show if a task is selected and has subtasks */}
                    {selectedTaskIds.length > 0 && (() => {
                        const selectedTask = tasks.find(t => selectedTaskIds.includes(t.id))
                        const availableSubtasks = selectedTask?.subtasks?.filter(st => !st.isDone) || []
                        
                        if (availableSubtasks.length > 0) {
                            return (
                                <div className="w-[160px] shrink-0">
                                    <Select
                                        value={selectedSubtaskId || undefined}
                                        onValueChange={(value) => setSelectedSubtaskId(value)}
                                        disabled={!!optimisticEntry}
                                    >
                                        <SelectTrigger className="bg-background border-input hover:bg-accent/50 text-sm h-9 shadow-sm">
                                            <SelectValue placeholder="Subtask..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableSubtasks.map((subtask) => (
                                                <SelectItem key={subtask.id} value={subtask.id}>
                                                    {subtask.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )
                        }
                        return null
                    })()}
                </div>

                {/* Controls Area */}
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">

                    {/* Timer / Manual Inputs */}
                    {!optimisticEntry && isManualMode ? (
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
                        {!optimisticEntry ? (
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
                                    disabled={loading || !isDataLoaded}
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
