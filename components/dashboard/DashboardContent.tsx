"use client"

import { useState, useEffect } from "react"
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
    // State to hold the optimistically stopped entry
    const [optimisticStoppedEntry, setOptimisticStoppedEntry] = useState<TimeEntry | null>(null)

    // Callback for when timer is stopped - creates optimistic entry
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

        // Create a temporary entry with a temporary ID
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

    // Clear optimistic entry when server data arrives
    const handleOptimisticEntryCleared = () => {
        setOptimisticStoppedEntry(null)
    }

    // Check if a real entry matches the optimistic one and remove optimistic if so
    useEffect(() => {
        if (!optimisticStoppedEntry) return

        // Check if any server entry matches the optimistic entry (by time range)
        const matchingEntry = historyEntries.find(entry => {
            const optStart = new Date(optimisticStoppedEntry.startTime).getTime()
            const optEnd = optimisticStoppedEntry.endTime ? new Date(optimisticStoppedEntry.endTime).getTime() : null
            const realStart = new Date(entry.startTime).getTime()
            const realEnd = entry.endTime ? new Date(entry.endTime).getTime() : null

            // Match if start times are within 2 seconds and end times are within 2 seconds
            return Math.abs(optStart - realStart) < 2000 &&
                optEnd && realEnd && Math.abs(optEnd - realEnd) < 2000
        })

        if (matchingEntry) {
            // Real entry found, remove optimistic one
            setOptimisticStoppedEntry(null)
        }
    }, [historyEntries, optimisticStoppedEntry])

    // Combine server entries with optimistic entry
    const allEntries = optimisticStoppedEntry
        ? [optimisticStoppedEntry, ...historyEntries]
        : historyEntries

    return (
        <>
            <ControlBar
                activeEntry={activeEntry}
                tasks={tasks}
                onTimerStopped={handleTimerStopped}
            />
            <div className="pt-2">
                <InsightsWidget />
            </div>
            <div className="pt-4">
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

