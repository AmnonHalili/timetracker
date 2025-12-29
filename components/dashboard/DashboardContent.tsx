"use client"

import { useState, useEffect, startTransition } from "react"
import { useRouter } from "next/navigation"
import { ControlBar } from "./ControlBar"
import { EntryHistory } from "./EntryHistory"
import { InsightsWidget } from "@/components/analytics/InsightsWidget"

interface TimeEntry {
    id: string
    startTime: Date | string
    endTime: Date | string | null
    description?: string | null
    isManual?: boolean
    breaks?: Array<{
        startTime: Date | string
        endTime: Date | string | null
    }>
    tasks?: Array<{ id: string; title: string }>
    subtask?: { id: string; title: string } | null
}

interface Task {
    id: string
    title: string
    status?: string
    subtasks?: Array<{ id: string; title: string; isDone: boolean }>
}

interface DashboardContentProps {
    activeEntry: {
        startTime: Date | string
        breaks?: Array<{
            startTime: Date | string
            endTime: Date | string | null
        }>
        taskId?: string | null
        description?: string | null
        tasks?: Array<{ id: string; title: string }>
        subtaskId?: string | null
        subtask?: { id: string; title: string } | null
    } | null
    historyEntries: TimeEntry[]
    tasks: Task[]
}

export function DashboardContent({ activeEntry, historyEntries, tasks }: DashboardContentProps) {
    const router = useRouter()
    // State to hold the optimistically stopped entry
    const [optimisticStoppedEntry, setOptimisticStoppedEntry] = useState<TimeEntry | null>(null)
    // Local state for entries to allow immediate updates without full page refresh
    const [localHistoryEntries, setLocalHistoryEntries] = useState(historyEntries)
    
    // Sync with server data when it changes
    useEffect(() => {
        // When server entries arrive, check if we should remove optimistic entry
        if (optimisticStoppedEntry) {
            // Check if any server entry matches the optimistic entry
            const matchingEntry = historyEntries.find(entry => {
                const optStart = new Date(optimisticStoppedEntry.startTime).getTime()
                const optEnd = optimisticStoppedEntry.endTime ? new Date(optimisticStoppedEntry.endTime).getTime() : null
                const realStart = new Date(entry.startTime).getTime()
                const realEnd = entry.endTime ? new Date(entry.endTime).getTime() : null

                // Match by context (same tasks/subtask/description)
                const optTaskIds = (optimisticStoppedEntry.tasks || []).map(t => t.id).sort()
                const realTaskIds = (entry.tasks || []).map(t => t.id).sort()
                const taskIdsMatch = 
                    optTaskIds.length === realTaskIds.length &&
                    optTaskIds.every((id, idx) => id === realTaskIds[idx])
                
                const subtaskMatch = 
                    (!optimisticStoppedEntry.subtask && !entry.subtask) ||
                    (optimisticStoppedEntry.subtask?.id === entry.subtask?.id)

                // Match by description
                const optDesc = optimisticStoppedEntry.description?.trim() || null
                const realDesc = entry.description?.trim() || null
                const descriptionMatch = 
                    (!optDesc && !realDesc) ||
                    (optDesc && realDesc && optDesc === realDesc)

                if (!taskIdsMatch || !subtaskMatch || !descriptionMatch) return false

                // For new entries: times should be very close (within 10 seconds)
                // For merged entries: times should overlap
                const startTimeDiff = Math.abs(optStart - realStart)
                const endTimeDiff = optEnd && realEnd ? Math.abs(optEnd - realEnd) : 0
                const timesClose = startTimeDiff < 10000 && endTimeDiff < 10000 // Within 10 seconds
                
                const timesOverlap = optStart >= realStart && optEnd && realEnd && optEnd <= realEnd
                
                return timesClose || timesOverlap
            })

            if (matchingEntry) {
                // Real entry found (new or merged), remove optimistic one
                setOptimisticStoppedEntry(null)
            }
        }
        
        // Update local entries with server data
        setLocalHistoryEntries(historyEntries)
    }, [historyEntries, optimisticStoppedEntry])

    // Callback for when timer is stopped - merges with existing entry if found, otherwise creates new
    const handleTimerStopped = (stoppedEntry: {
        startTime: Date
        endTime: Date
        description?: string | null
        breaks?: Array<{ startTime: Date; endTime: Date | null }>
        tasks?: Array<{ id: string; title: string }>
        subtaskId?: string | null
    }) => {
        // Find subtask title from tasks array if subtaskId is provided
        let subtaskTitle = ''
        if (stoppedEntry.subtaskId) {
            for (const task of tasks) {
                const subtask = task.subtasks?.find(st => st.id === stoppedEntry.subtaskId)
                if (subtask) {
                    subtaskTitle = subtask.title
                    break
                }
            }
        }

        const stoppedTaskIds = (stoppedEntry.tasks || []).map(t => t.id).sort()
        const stoppedSubtaskId = stoppedEntry.subtaskId || null
        const stoppedStart = new Date(stoppedEntry.startTime)
        const stoppedEnd = new Date(stoppedEntry.endTime)
        
        // Check if there's an existing entry with the same context (same day)
        const dayStart = new Date(stoppedStart)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(dayStart)
        dayEnd.setHours(23, 59, 59, 999)

        const matchingEntry = localHistoryEntries.find(entry => {
            const entryStart = new Date(entry.startTime)
            // Check if same day
            if (entryStart < dayStart || entryStart > dayEnd) return false
            
            // Match by context (same tasks/subtask)
            const entryTaskIds = (entry.tasks || []).map(t => t.id).sort()
            const entrySubtaskId = entry.subtask?.id || null
            
            const taskIdsMatch = 
                stoppedTaskIds.length === entryTaskIds.length &&
                stoppedTaskIds.every((id, idx) => id === entryTaskIds[idx])
            
            const subtaskMatch = 
                (!stoppedSubtaskId && !entrySubtaskId) ||
                (stoppedSubtaskId === entrySubtaskId)
            
            // Match by description - both must be null/empty or both must be the same
            const stoppedDesc = stoppedEntry.description?.trim() || null
            const entryDesc = entry.description?.trim() || null
            const descriptionMatch = 
                (!stoppedDesc && !entryDesc) ||
                (stoppedDesc && entryDesc && stoppedDesc === entryDesc)
            
            return taskIdsMatch && subtaskMatch && descriptionMatch
        })

        if (matchingEntry) {
            // Merge with existing entry immediately
            const existingStart = new Date(matchingEntry.startTime)
            const existingEnd = matchingEntry.endTime ? new Date(matchingEntry.endTime) : null
            
            // Keep earliest start time
            const mergedStart = existingStart < stoppedStart ? existingStart : stoppedStart
            // Use latest end time
            const mergedEnd = existingEnd && existingEnd > stoppedEnd ? existingEnd : stoppedEnd

            // Calculate gap between sessions to add as break
            let gapBreak: { startTime: Date; endTime: Date } | null = null
            if (existingEnd && stoppedStart > existingEnd) {
                // Gap between existing end and new start
                gapBreak = { startTime: existingEnd, endTime: stoppedStart }
            } else if (existingStart && stoppedEnd < existingStart) {
                // New session ends before existing starts
                gapBreak = { startTime: stoppedEnd, endTime: existingStart }
            }

            // Merge breaks
            const existingBreaks = (matchingEntry.breaks || []).map(b => ({
                startTime: new Date(b.startTime),
                endTime: b.endTime ? new Date(b.endTime) : null
            }))
            const newBreaks = (stoppedEntry.breaks || []).map(b => ({
                startTime: new Date(b.startTime),
                endTime: b.endTime ? new Date(b.endTime) : null
            }))
            const allBreaks = gapBreak 
                ? [...existingBreaks, ...newBreaks, { startTime: gapBreak.startTime, endTime: gapBreak.endTime }]
                : [...existingBreaks, ...newBreaks]

            // Update existing entry immediately
            const mergedEntry: TimeEntry = {
                ...matchingEntry,
                startTime: mergedStart,
                endTime: mergedEnd,
                breaks: allBreaks,
                // Keep existing description if it exists, otherwise use new one
                description: matchingEntry.description || stoppedEntry.description || null
            }

            // Update local entries immediately
            setLocalHistoryEntries(prev => prev.map(e => 
                e.id === matchingEntry.id ? mergedEntry : e
            ))
            
            // Don't set optimistic entry since we merged immediately
            setOptimisticStoppedEntry(null)
        } else {
            // No matching entry - create new optimistic entry
            const optimisticEntry: TimeEntry = {
                id: `temp-${Date.now()}`, // Temporary ID
                startTime: stoppedEntry.startTime,
                endTime: stoppedEntry.endTime,
                description: stoppedEntry.description || null,
                isManual: false,
                breaks: stoppedEntry.breaks || [],
                tasks: stoppedEntry.tasks || [],
                subtask: stoppedEntry.subtaskId ? { id: stoppedEntry.subtaskId, title: subtaskTitle } : null
            }
            setOptimisticStoppedEntry(optimisticEntry)
        }
    }

    // Clear optimistic entry when server data arrives
    const handleOptimisticEntryCleared = () => {
        setOptimisticStoppedEntry(null)
    }


    // Combine server entries with optimistic entry
    const allEntries = optimisticStoppedEntry
        ? [optimisticStoppedEntry, ...localHistoryEntries]
        : localHistoryEntries
    
    // Callback to update entries immediately when merged (without full refresh)
    // This is called when the API confirms the merge - we already merged optimistically, so just sync
    const handleEntryMerged = (mergedEntry: TimeEntry) => {
        // Remove optimistic entry if exists
        setOptimisticStoppedEntry(null)
        
        // Update local entries - replace matching entry (we already merged optimistically)
        setLocalHistoryEntries(prev => {
            const mergedTaskIds = (mergedEntry.tasks || []).map(t => t.id).sort()
            const mergedSubtaskId = mergedEntry.subtask?.id || null
            
            const existingIndex = prev.findIndex(entry => {
                const entryTaskIds = (entry.tasks || []).map(t => t.id).sort()
                const entrySubtaskId = entry.subtask?.id || null
                
                const taskIdsMatch = 
                    mergedTaskIds.length === entryTaskIds.length &&
                    mergedTaskIds.every((id, idx) => id === entryTaskIds[idx])
                const subtaskMatch = 
                    (!mergedSubtaskId && !entrySubtaskId) ||
                    (mergedSubtaskId === entrySubtaskId)
                
                return taskIdsMatch && subtaskMatch
            })
            
            if (existingIndex >= 0) {
                // Replace existing entry with server-confirmed merged one
                const updated = [...prev]
                updated[existingIndex] = mergedEntry
                return updated
            } else {
                // Entry not found (shouldn't happen, but handle gracefully)
                // Remove any temp entries and add the merged one
                const withoutTemp = prev.filter(e => !e.id.startsWith('temp-'))
                return [mergedEntry, ...withoutTemp]
            }
        })
        
        // Refresh in background (non-blocking) to sync with server
        startTransition(() => {
            router.refresh()
        })
    }

    return (
        <>
            <ControlBar
                activeEntry={activeEntry}
                tasks={tasks}
                onTimerStopped={handleTimerStopped}
                onEntryMerged={handleEntryMerged}
            />
            <div className="pt-0 md:pt-2">
                <InsightsWidget />
            </div>
            <div className="pt-2 md:pt-4">
                <EntryHistory
                    entries={allEntries as never}
                    tasks={tasks}
                    optimisticEntryId={optimisticStoppedEntry?.id}
                    onOptimisticEntryCleared={handleOptimisticEntryCleared}
                />
            </div>
        </>
    )
}

