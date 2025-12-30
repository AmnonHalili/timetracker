"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pause, Square } from "lucide-react"

import { useState, useEffect, startTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/lib/useLanguage"

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
        status?: string
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
    onEntryMerged?: (mergedEntry: {
        id: string
        startTime: Date | string
        endTime: Date | string | null
        description?: string | null
        isManual?: boolean
        breaks?: Array<{ startTime: Date | string; endTime: Date | string | null }>
        tasks?: Array<{ id: string; title: string }>
        subtask?: { id: string; title: string } | null
    }) => void
}

export function ControlBar({ activeEntry, tasks, onTimerStopped, onEntryMerged }: ControlBarProps) {
    const router = useRouter()
    const { t } = useLanguage()
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
    const [timeError, setTimeError] = useState("")
    const [isDataLoaded, setIsDataLoaded] = useState(!!activeEntry) // Track if server data has loaded - true if we already have activeEntry
    const inputRef = useRef<HTMLInputElement>(null)
    const isInputFocusedRef = useRef(false)

    // Sync optimistic state with server state when it arrives
    // Preserve optimistic startTime to prevent jumping while allowing smooth updates
    useEffect(() => {
        if (activeEntry) {
            setOptimisticEntry(prev => {
                if (prev) {
                    const optimisticStart = new Date(prev.startTime).getTime()
                    const serverStart = new Date(activeEntry.startTime).getTime()
                    const now = Date.now()

                    // If we have an optimistic entry that was just created (within last 10 seconds)
                    // and the server time is close (within 5 seconds), keep the optimistic startTime
                    // This prevents jumping while still allowing the timer to start immediately
                    const timeSinceOptimistic = now - optimisticStart
                    const timeDiff = Math.abs(serverStart - optimisticStart)

                    if (timeSinceOptimistic < 10000 && timeDiff < 5000) {
                        // Merge server data (tasks, description, breaks) but keep optimistic startTime
                        return {
                            ...activeEntry,
                            startTime: prev.startTime,
                            // Preserve breaks from optimistic if they're more recent
                            breaks: prev.breaks && prev.breaks.length > 0
                                ? prev.breaks
                                : activeEntry.breaks
                        }
                    }
                }
                // Use server value if no optimistic entry or it's old
                return activeEntry
            })
            // Mark data as loaded when server entry arrives
            setIsDataLoaded(true)
        } else {
            // Server says no active entry, clear optimistic state
            // But don't clear selectedTaskIds - keep it so subtask selector remains visible
            setOptimisticEntry(null)
            setIsDataLoaded(false)
        }
    }, [activeEntry])

    useEffect(() => {
        // Don't update description if user is currently typing
        if (isInputFocusedRef.current) return
        
        if (optimisticEntry?.description) {
            setDescription(optimisticEntry.description)
        } else if (!optimisticEntry) {
            setDescription("")
        }

        if (optimisticEntry?.tasks) {
            // When timer is running, sync task selection with active entry
            setSelectedTaskIds(optimisticEntry.tasks.map(t => t.id))
        }
        // Don't clear selectedTaskIds when optimisticEntry is null (after stop)
        // This keeps the subtask selector visible so user can select a new subtask
        
        if (optimisticEntry?.subtaskId !== undefined) {
            // When timer is running, sync subtask selection with active entry
            setSelectedSubtaskId(optimisticEntry.subtaskId)
        } else if (!optimisticEntry) {
            // Only clear subtask selection when timer stops, not task selection
            // This allows user to select a different subtask for the same task
            setSelectedSubtaskId(null)
        }
    }, [optimisticEntry])
    
    // Clear selectedSubtaskId if the selected subtask is now done
    useEffect(() => {
        if (!selectedSubtaskId || selectedTaskIds.length === 0) return
        
        const selectedTask = tasks.find(t => selectedTaskIds.includes(t.id))
        if (!selectedTask) return
        
        const selectedSubtask = selectedTask.subtasks?.find(st => st.id === selectedSubtaskId)
        // If selected subtask is done, clear the selection
        if (selectedSubtask?.isDone) {
            setSelectedSubtaskId(null)
        }
    }, [tasks, selectedSubtaskId, selectedTaskIds])


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

    // Handle description update
    const handleDescriptionUpdate = async (newDescription: string) => {
        if (!activeEntry || !optimisticEntry) return
        
        try {
            // Get active entry ID from server
            const activeEntryResponse = await fetch('/api/time-entries')
            if (activeEntryResponse.ok) {
                const { activeEntry: serverActiveEntry } = await activeEntryResponse.json()
                if (serverActiveEntry?.id) {
                    await fetch('/api/time-entries', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: serverActiveEntry.id,
                            description: newDescription || null
                        })
                    })
                    // Update optimistic entry
                    setOptimisticEntry(prev => prev ? { ...prev, description: newDescription || null } : null)
                }
            }
        } catch (error) {
            console.error("Failed to update description:", error)
        }
    }

    // Handle subtask update
    const handleSubtaskUpdate = async (newSubtaskId: string | null) => {
        if (!activeEntry || !optimisticEntry) return
        
        try {
            // Get active entry ID from server
            const activeEntryResponse = await fetch('/api/time-entries')
            if (activeEntryResponse.ok) {
                const { activeEntry: serverActiveEntry } = await activeEntryResponse.json()
                if (serverActiveEntry?.id) {
                    await fetch('/api/time-entries', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: serverActiveEntry.id,
                            subtaskId: newSubtaskId
                        })
                    })
                    // Update optimistic entry
                    setOptimisticEntry(prev => prev ? { ...prev, subtaskId: newSubtaskId } : null)
                    startTransition(() => {
                    router.refresh()
                    })
                }
            }
        } catch (error) {
            console.error("Failed to update subtask:", error)
        }
    }

    // Handle task change - splits current entry and creates new one
    const handleTaskChange = async (oldTaskIds: string[], newTaskIds: string[]) => {
        if (!activeEntry || !optimisticEntry) return
        
        setLoading(true)
        const now = new Date()
        
        // Optimistic update - update state immediately so subtasks appear instantly
        const newTasks = newTaskIds.length > 0
            ? tasks.filter(t => newTaskIds.includes(t.id))
            : undefined
        
        // Update optimistic entry immediately with new tasks (subtasks will appear instantly)
        setOptimisticEntry({
            startTime: now,
            breaks: [],
            description: description || null,
            tasks: newTasks,
            subtaskId: null
        })
        
        // Create stopped entry data for optimistic display
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
        
        try {
            // Stop current entry (set endTime)
            await fetch('/api/time-entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'stop'
                })
            })

            // Immediately start new entry with new task
            await fetch('/api/time-entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start',
                    description: description || null,
                    taskIds: newTaskIds.length > 0 ? newTaskIds : undefined,
                    subtaskId: null // Clear subtask when task changes
                })
            })

            startTransition(() => {
            router.refresh()
            })
        } catch (error) {
            console.error("Failed to change task:", error)
            // Revert optimistic update on error
            setOptimisticEntry({
                startTime: optimisticEntry.startTime,
                breaks: optimisticEntry.breaks || [],
                description: optimisticEntry.description || null,
                tasks: optimisticEntry.tasks,
                subtaskId: optimisticEntry.subtaskId || null
            })
            setSelectedTaskIds(oldTaskIds)
            alert("Failed to change task. Please try again.")
        } finally {
            setLoading(false)
        }
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

                const manualResponse = await fetch('/api/time-entries', {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'manual',
                        manualData: { start, end, description },
                        taskIds: selectedTaskIds.length > 0 ? selectedTaskIds : undefined,
                        subtaskId: selectedSubtaskId || null
                    }),
                })
                const manualData = await manualResponse.json()
                
                setManualStart("")
                setManualEnd("")
                setTimeError("")
                setDescription("")
                setSelectedTaskIds([])
                setSelectedSubtaskId(null)
                
                // If merged, update UI immediately
                if (manualData.merged && manualData.entry && onEntryMerged) {
                    onEntryMerged(manualData.entry)
                } else {
                    startTransition(() => {
                        router.refresh()
                    })
                }
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
            startTransition(() => {
            router.refresh()
            })
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
            // Keep selectedTaskIds so subtask selector remains visible
            // Only clear selectedSubtaskId to allow selecting a new subtask
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
            const response = await fetch('/api/time-entries', {
                method: 'POST',
                body: JSON.stringify({ action }),
            })
            const data = await response.json()
            
            // If entries were merged, update UI immediately without full refresh
            if (data.merged && action === 'stop' && data.entry && onEntryMerged) {
                // Clear optimistic entry immediately since it was merged
                setOptimisticEntry(null)
                setDescription("")
                // Keep selectedTaskIds so subtask selector remains visible
                // Only clear selectedSubtaskId to allow selecting a new subtask
                setSelectedSubtaskId(null)
                
                // Update UI immediately with merged entry
                onEntryMerged(data.entry)
            } else {
                // Normal case - refresh in background
                startTransition(() => {
                    router.refresh()
                })
            }
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
            <div className={`flex flex-col md:flex-row ${!optimisticEntry && isManualMode ? 'items-end' : 'items-center'} justify-between gap-4 bg-muted/30 p-3 rounded-xl`}>

                {/* Inputs Area */}
                <div className="flex flex-1 items-center gap-3 w-full">
                    <label htmlFor="work-description" className="sr-only">
                        {t('dashboard.whatWorkingOn')}
                    </label>
                    <Input
                        ref={inputRef}
                        id="work-description"
                        placeholder={t('dashboard.whatWorkingOn')}
                        value={description}
                        onFocus={() => {
                            isInputFocusedRef.current = true
                        }}
                        onBlur={(e) => {
                            isInputFocusedRef.current = false
                            // Save description when input loses focus
                            if (optimisticEntry && activeEntry) {
                                handleDescriptionUpdate(e.target.value)
                            }
                        }}
                        onChange={(e) => {
                            setDescription(e.target.value)
                            // Update description on active entry if timer is running
                            if (optimisticEntry && activeEntry) {
                                handleDescriptionUpdate(e.target.value)
                            }
                        }}
                        className="bg-background border-input hover:bg-accent/50 focus:bg-background shadow-sm h-9 text-sm flex-1 min-w-0"
                        aria-label={t('dashboard.whatWorkingOn')}
                    />

                    {/* Task Selector */}
                    <div className="w-[100px] md:w-[180px] shrink-0">
                        <Select
                            value={selectedTaskIds.length > 0 ? selectedTaskIds[0] : undefined}
                            onValueChange={(value) => {
                                const newTaskIds = value === "__none__" ? [] : (value ? [value] : [])
                                
                                // If timer is running and task changed, split the entry
                                if (optimisticEntry && activeEntry) {
                                    const taskIdsChanged = JSON.stringify(newTaskIds.sort()) !== JSON.stringify(selectedTaskIds.sort())
                                    if (taskIdsChanged) {
                                        // Update state immediately for instant UI feedback (subtasks will appear immediately)
                                        setSelectedTaskIds(newTaskIds)
                                        setSelectedSubtaskId(null)
                                        // Then handle the task change in background
                                        handleTaskChange(selectedTaskIds, newTaskIds)
                                        return
                                    }
                                }
                                
                                // Update state immediately for instant UI feedback
                                setSelectedTaskIds(newTaskIds)
                                // Clear subtask selection when task changes
                                setSelectedSubtaskId(null)
                            }}
                        >
                            <SelectTrigger className="bg-background border-input hover:bg-accent/50 text-sm h-9 shadow-sm">
                                <SelectValue placeholder={t('tasks.tasksPlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">{t('tasks.noTask')}</SelectItem>
                                {tasks.map((task) => (
                                    <SelectItem key={task.id} value={task.id}>
                                        {task.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Subtask Selector - Only show if a task is selected and has available subtasks */}
                    {selectedTaskIds.length > 0 && (() => {
                        const selectedTask = tasks.find(t => selectedTaskIds.includes(t.id))
                        const allSubtasks = selectedTask?.subtasks || []
                        // Filter out done subtasks - only show subtasks that are not done
                        const availableSubtasks = allSubtasks.filter(st => !st.isDone)
                        
                        // Only show subtask selector if there are available (not done) subtasks
                        if (availableSubtasks.length > 0) {
                            return (
                                <div className="w-[160px] shrink-0">
                                    <Select
                                        value={selectedSubtaskId || undefined}
                                        onValueChange={(value) => {
                                            setSelectedSubtaskId(value)
                                            // Update subtask on active entry if timer is running
                                            if (optimisticEntry && activeEntry) {
                                                handleSubtaskUpdate(value || null)
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="bg-background border-input hover:bg-accent/50 text-sm h-9 shadow-sm">
                                            <SelectValue placeholder={t('tasks.subtaskPlaceholder')} />
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

                    {/* Task Done button - Always show when task is selected and timer is running */}
                    {selectedTaskIds.length > 0 && optimisticEntry && (() => {
                        const selectedTask = tasks.find(t => selectedTaskIds.includes(t.id))
                        if (!selectedTask) return null
                        
                        const isTaskDone = selectedTask.status === 'DONE'
                        const allSubtasks = selectedTask?.subtasks || []
                        const availableSubtasks = allSubtasks.filter(st => !st.isDone)
                        // Check if subtask is selected and get its done status
                        const selectedSubtask = selectedSubtaskId 
                            ? allSubtasks.find(st => st.id === selectedSubtaskId)
                            : null
                        const isSubtaskDone = selectedSubtask?.isDone ?? false
                        
                        return (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                    try {
                                        // If subtask is selected, mark only the subtask as done
                                        if (selectedSubtaskId && selectedSubtask) {
                                            await fetch('/api/tasks/subtasks', {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    id: selectedSubtask.id,
                                                    isDone: !isSubtaskDone
                                                })
                                            })
                                            
                                            // If marking subtask as done, clear the selection so it disappears from the list
                                            if (!isSubtaskDone) {
                                                setSelectedSubtaskId(null)
                                            }
                                            
                                            // Refresh to update UI
                                            startTransition(() => {
                                                router.refresh()
                                            })
                                        } else {
                                            // Mark task as done
                                            await fetch('/api/tasks', {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    id: selectedTask.id,
                                                    status: isTaskDone ? 'TODO' : 'DONE'
                                                })
                                            })
                                            
                                            // If marking as done, mark all subtasks as done
                                            if (!isTaskDone && availableSubtasks.length > 0) {
                                                const subtasksToUpdate = availableSubtasks.filter(st => !st.isDone)
                                                if (subtasksToUpdate.length > 0) {
                                                    // Update all subtasks in parallel
                                                    await Promise.all(
                                                        subtasksToUpdate.map(subtask =>
                                                            fetch('/api/tasks/subtasks', {
                                                                method: 'PATCH',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({
                                                                    id: subtask.id,
                                                                    isDone: true
                                                                })
                                                            }).catch(err => {
                                                                console.error(`Failed to update subtask ${subtask.id}:`, err)
                                                            })
                                                        )
                                                    )
                                                }
                                            }
                                            
                                            // Stop current time entry to add it to history (only if marking as done, not when unmarking)
                                            if (!isTaskDone && optimisticEntry && onTimerStopped) {
                                                const now = new Date()
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
                                                
                                                const stopResponse = await fetch('/api/time-entries', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        action: 'stop'
                                                    })
                                                })
                                                const stopData = await stopResponse.json()
                                                
                                                // Clear optimistic entry
                                                setOptimisticEntry(null)
                                                setDescription("")
                                                setSelectedTaskIds([])
                                                setSelectedSubtaskId(null)
                                                
                                                // If merged, update UI immediately
                                                if (stopData.merged && stopData.entry && onEntryMerged) {
                                                    onEntryMerged(stopData.entry)
                                                } else {
                                                    startTransition(() => {
                                                        router.refresh()
                                                    })
                                                }
                                            } else {
                                                // Just refresh if unmarking as done
                                                startTransition(() => {
                                                    router.refresh()
                                                })
                                            }
                                        }
                                    } catch (error) {
                                        console.error("Failed to update task status:", error)
                                        alert("Failed to update task status. Please try again.")
                                    }
                                }}
                                className="shrink-0 h-9 border-primary text-primary hover:bg-transparent hover:border-primary/80 hover:text-primary/90"
                            >
                                {t('tasks.taskDone')}
                            </Button>
                        )
                    })()}
                </div>

                {/* Controls Area */}
                <div className={`flex ${!optimisticEntry && isManualMode ? 'items-end' : 'items-center'} gap-4 w-full md:w-auto justify-between md:justify-end`}>

                    {/* Timer / Manual Inputs */}
                    {!optimisticEntry && isManualMode ? (
                        <div className="relative flex items-end gap-2">
                            <div className="flex flex-col gap-1">
                                <label htmlFor="manual-start-time" className="text-[10px] text-muted-foreground font-medium">
                                    {t('dashboard.startTime')}
                            </label>
                            <Input
                                id="manual-start-time"
                                type="time"
                                value={manualStart}
                                    onChange={(e) => {
                                        setManualStart(e.target.value)
                                        // Check if end time is before start time
                                        if (e.target.value && manualEnd && e.target.value >= manualEnd) {
                                            setTimeError(t('dashboard.endTimeBeforeStart'))
                                        } else {
                                            setTimeError("")
                                        }
                                    }}
                                    className={`w-[95px] h-9 text-sm bg-background border-input shadow-sm ${timeError ? 'border-destructive' : ''}`}
                                aria-label="Start time"
                            />
                            </div>
                            <span className="text-muted-foreground mb-2" aria-hidden="true">-</span>
                            <div className="flex flex-col gap-1">
                                <label htmlFor="manual-end-time" className="text-[10px] text-muted-foreground font-medium">
                                    {t('dashboard.endTime')}
                            </label>
                            <Input
                                id="manual-end-time"
                                type="time"
                                value={manualEnd}
                                    onChange={(e) => {
                                        setManualEnd(e.target.value)
                                        // Check if end time is before start time
                                        if (manualStart && e.target.value && manualStart >= e.target.value) {
                                            setTimeError(t('dashboard.endTimeBeforeStart'))
                                        } else {
                                            setTimeError("")
                                        }
                                    }}
                                    className={`w-[95px] h-9 text-sm bg-background border-input shadow-sm ${timeError ? 'border-destructive' : ''}`}
                                aria-label="End time"
                            />
                            </div>
                            {timeError && (
                                <div className="absolute -bottom-5 left-0">
                                    <p className="text-[10px] text-destructive px-1 whitespace-nowrap">
                                        {timeError}
                                    </p>
                                </div>
                            )}
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
                                    onClick={() => {
                                        setIsManualMode(!isManualMode)
                                        if (isManualMode) {
                                            // Clearing manual mode - reset fields
                                            setManualStart("")
                                            setManualEnd("")
                                            setTimeError("")
                                        }
                                    }}
                                    className={`h-9 px-3 text-xs font-medium border-dashed ${isManualMode ? 'bg-primary/10 text-primary border-primary/20' : 'text-muted-foreground border-border'}`}
                                >
                                    {isManualMode ? t('dashboard.timer') : t('dashboard.manual')}
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleStart}
                                    disabled={loading || (isManualMode && (!manualStart || !manualEnd || !!timeError))}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium min-w-[80px] h-9 shadow-sm"
                                >
                                    {isManualMode ? t('dashboard.add') : t('dashboard.start')}
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
                                        {t('dashboard.resume')}
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-primary/30 bg-white text-muted-foreground hover:bg-white hover:text-muted-foreground font-medium h-9 shadow-sm"
                                        onClick={() => handleAction('pause')}
                                        disabled={loading}
                                    >
                                        <Pause className="h-4 w-4 mr-2" />
                                        {t('dashboard.pause')}
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium h-9 shadow-sm"
                                    onClick={() => handleAction('stop')}
                                    disabled={loading || !isDataLoaded}
                                >
                                    <Square className="h-4 w-4 mr-2" />
                                    {t('dashboard.stop')}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
