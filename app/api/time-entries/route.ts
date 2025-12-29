import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { startOfDay, endOfDay } from "date-fns"
// Note: Location verification is now handled by Workday, not TimeEntry

// GET: Fetch currently running entry + recent history
export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const entries = await prisma.timeEntry.findMany({
            where: { userId: session.user.id },
            select: {
                id: true,
                userId: true,
                startTime: true,
                endTime: true,
                description: true,
                isManual: true,
                createdAt: true,
                updatedAt: true,
                subtaskId: true,
                breaks: true,
                tasks: true
            },
            orderBy: { createdAt: 'desc' }, // Updated orderBy
            take: 50, // Limit to recent 50 for dashboard performance
        })

        // The instruction implies returning only entries, but the original code also returned activeEntry.
        // To maintain existing client-side expectations for activeEntry, we'll keep it.
        const activeEntry = entries.find(e => e.endTime === null)

        return NextResponse.json({ entries, activeEntry })
    } catch {
        return NextResponse.json({ message: "Error fetching entries" }, { status: 500 })
    }
}

// POST: Toggle Timer (Start/Stop/Pause/Resume) or Create Manual Entry
export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { action, manualData, taskIds, description, subtaskId }: {
        action: 'start' | 'stop' | 'pause' | 'resume' | 'manual',
        manualData?: Record<string, unknown>,
        taskIds?: string[],
        description?: string,
        subtaskId?: string | null
    } = await req.json()

    try {
        // 1. START TIMER
        if (action === "start") {
            const active = await prisma.timeEntry.findFirst({
                where: { userId: session.user.id, endTime: null },
                select: {
                    id: true,
                    userId: true,
                    startTime: true,
                    endTime: true
                }
            })

            if (active) {
                return NextResponse.json({ message: "Timer already running" }, { status: 400 })
            }

            // Note: Location verification is handled by Workday, not TimeEntry
            // TimeEntry is only for task tracking, not location tracking

            const newEntry = await prisma.timeEntry.create({
                data: {
                    userId: session.user.id,
                    startTime: new Date(),
                    description,
                    isManual: false,
                    tasks: taskIds && taskIds.length > 0 ? {
                        connect: taskIds.map(id => ({ id }))
                    } : undefined,
                    subtaskId: subtaskId || null,
                }
            })

            return NextResponse.json({ entry: newEntry })
        }

        // 2. STOP TIMER
        if (action === "stop") {
            const active = await prisma.timeEntry.findFirst({
                where: { userId: session.user.id, endTime: null },
                select: {
                    id: true,
                    userId: true,
                    startTime: true,
                    endTime: true,
                    description: true,
                    isManual: true,
                    createdAt: true,
                    updatedAt: true,
                    subtaskId: true,
                    breaks: true,
                    tasks: {
                        select: {
                            id: true
                        }
                    }
                }
            })

            if (!active) {
                return NextResponse.json({ message: "No active timer found" }, { status: 400 })
            }

            // Close any open breaks
            const activeBreak = active.breaks.find(b => b.endTime === null)
            if (activeBreak) {
                await prisma.timeBreak.update({
                    where: { id: activeBreak.id },
                    data: { endTime: new Date() }
                })
            }

            const endTime = new Date()
            const startTime = new Date(active.startTime)
            const dayStart = startOfDay(startTime)
            const dayEnd = endOfDay(startTime)

            // Get task IDs for context matching
            const activeTaskIds = active.tasks.map(t => t.id).sort()
            const activeSubtaskId = active.subtaskId

            // Get active entry description for matching
            const activeDescription = active.description?.trim() || null

            // Find existing entries for the same day with the same context
            const existingEntries = await prisma.timeEntry.findMany({
                where: {
                    userId: session.user.id,
                    id: { not: active.id }, // Exclude the current active entry
                    endTime: { not: null }, // Only completed entries
                    startTime: {
                        gte: dayStart,
                        lte: dayEnd
                    },
                    subtaskId: activeSubtaskId, // Must match subtask (or both null)
                },
                select: {
                    id: true,
                    startTime: true,
                    endTime: true,
                    description: true,
                    tasks: {
                        select: {
                            id: true
                        }
                    },
                    breaks: {
                        select: {
                            id: true,
                            startTime: true,
                            endTime: true
                        }
                    }
                }
            })

            // Find matching entry by task context and description
            // Match if: same task IDs (or both have no tasks), same subtaskId, and same description
            const matchingEntry = existingEntries.find(entry => {
                const entryTaskIds = entry.tasks.map(t => t.id).sort()
                const taskIdsMatch = 
                    (activeTaskIds.length === 0 && entryTaskIds.length === 0) ||
                    (activeTaskIds.length === entryTaskIds.length && 
                     activeTaskIds.every((id, idx) => id === entryTaskIds[idx]))
                
                // Match by description - both must be null/empty or both must be the same
                const entryDesc = entry.description?.trim() || null
                const descriptionMatch = 
                    (!activeDescription && !entryDesc) ||
                    (activeDescription && entryDesc && activeDescription === entryDesc)
                
                return taskIdsMatch && descriptionMatch
            })

            if (matchingEntry) {
                // Merge with existing entry
                const existingStart = new Date(matchingEntry.startTime)
                const existingEnd = matchingEntry.endTime ? new Date(matchingEntry.endTime) : null
                
                // Keep earliest start time
                const mergedStart = existingStart < startTime ? existingStart : startTime
                // Use latest end time
                const mergedEnd = existingEnd && existingEnd > endTime ? existingEnd : endTime

                // Move breaks from active entry to matching entry
                const activeBreaks = await prisma.timeBreak.findMany({
                    where: { timeEntryId: active.id }
                })

                // Update breaks to point to matching entry
                if (activeBreaks.length > 0) {
                    await prisma.timeBreak.updateMany({
                        where: { timeEntryId: active.id },
                        data: { timeEntryId: matchingEntry.id }
                    })
                }

                // Add gap between sessions as a break to ensure correct net work calculation
                // If sessions don't overlap, add the gap as a break
                if (existingEnd && startTime > existingEnd) {
                    // There's a gap between existing end and new start - add it as a break
                    await prisma.timeBreak.create({
                        data: {
                            timeEntryId: matchingEntry.id,
                            startTime: existingEnd,
                            endTime: startTime,
                            reason: 'gap_between_sessions'
                        }
                    })
                } else if (existingStart && endTime < existingStart) {
                    // New session ends before existing starts - add gap as break
                    await prisma.timeBreak.create({
                        data: {
                            timeEntryId: matchingEntry.id,
                            startTime: endTime,
                            endTime: existingStart,
                            reason: 'gap_between_sessions'
                        }
                    })
                }

                // Update matching entry with merged times
                const merged = await prisma.timeEntry.update({
                    where: { id: matchingEntry.id },
                    data: {
                        startTime: mergedStart,
                        endTime: mergedEnd,
                    },
                    select: {
                        id: true,
                        userId: true,
                        startTime: true,
                        endTime: true,
                        description: true,
                        isManual: true,
                        createdAt: true,
                        updatedAt: true,
                        subtaskId: true,
                        breaks: true,
                        tasks: true,
                        subtask: {
                            select: {
                                id: true,
                                title: true
                            }
                        }
                    }
                })

                // Delete the active entry (now merged)
                await prisma.timeEntry.delete({
                    where: { id: active.id }
                })

                return NextResponse.json({ entry: merged, merged: true })
            } else {
                // No matching entry found, just update the active entry
                const updated = await prisma.timeEntry.update({
                    where: { id: active.id },
                    data: {
                        endTime: endTime,
                    },
                    select: {
                        id: true,
                        userId: true,
                        startTime: true,
                        endTime: true,
                        description: true,
                        isManual: true,
                        createdAt: true,
                        updatedAt: true,
                        subtaskId: true,
                        breaks: true,
                        tasks: true
                    }
                })

                return NextResponse.json({ entry: updated, merged: false })
            }
        }

        // 3. PAUSE TIMER
        if (action === "pause") {
            const active = await prisma.timeEntry.findFirst({
                where: { userId: session.user.id, endTime: null },
                select: {
                    id: true,
                    userId: true,
                    startTime: true,
                    endTime: true,
                    description: true,
                    isManual: true,
                    createdAt: true,
                    updatedAt: true,
                    subtaskId: true,
                    breaks: true
                }
            })

            if (!active) {
                return NextResponse.json({ message: "No active timer found" }, { status: 400 })
            }

            // Check if already paused
            const activeBreak = active.breaks.find(b => b.endTime === null)
            if (activeBreak) {
                return NextResponse.json({ message: "Timer already paused" }, { status: 400 })
            }

            await prisma.timeBreak.create({
                data: {
                    timeEntryId: active.id,
                    startTime: new Date()
                }
            })

            return NextResponse.json({ message: "Paused" })
        }

        // 4. RESUME TIMER
        if (action === "resume") {
            const active = await prisma.timeEntry.findFirst({
                where: { userId: session.user.id, endTime: null },
                select: {
                    id: true,
                    userId: true,
                    startTime: true,
                    endTime: true,
                    description: true,
                    isManual: true,
                    createdAt: true,
                    updatedAt: true,
                    subtaskId: true,
                    breaks: true
                }
            })

            if (!active) {
                return NextResponse.json({ message: "No active timer found" }, { status: 400 })
            }

            const activeBreak = active.breaks.find(b => b.endTime === null)
            if (!activeBreak) {
                return NextResponse.json({ message: "Timer is not paused" }, { status: 400 })
            }

            await prisma.timeBreak.update({
                where: { id: activeBreak.id },
                data: { endTime: new Date() }
            })

            return NextResponse.json({ message: "Resumed" })
        }

        // 5. MANUAL ENTRY
        if (action === "manual") {
            console.log("API: Creating manual entry", manualData)
            const { start, end, description } = manualData as { start: string; end: string; description?: string }
            const startTime = new Date(start)
            const endTime = new Date(end)
            const dayStart = startOfDay(startTime)
            const dayEnd = endOfDay(startTime)

            // Get task IDs for context matching
            const entryTaskIds = (taskIds || []).sort()
            const entrySubtaskId = subtaskId || null
            const entryDescription = description?.trim() || null

            // Find existing entries for the same day with the same context
            const existingEntries = await prisma.timeEntry.findMany({
                where: {
                    userId: session.user.id,
                    endTime: { not: null }, // Only completed entries
                    startTime: {
                        gte: dayStart,
                        lte: dayEnd
                    },
                    subtaskId: entrySubtaskId, // Must match subtask (or both null)
                },
                select: {
                    id: true,
                    startTime: true,
                    endTime: true,
                    description: true,
                    tasks: {
                        select: {
                            id: true
                        }
                    },
                    breaks: {
                        select: {
                            id: true,
                            startTime: true,
                            endTime: true
                        }
                    }
                }
            })

            // Find matching entry by task context and description
            const matchingEntry = existingEntries.find(entry => {
                const existingTaskIds = entry.tasks.map(t => t.id).sort()
                const taskIdsMatch = 
                    (entryTaskIds.length === 0 && existingTaskIds.length === 0) ||
                    (entryTaskIds.length === existingTaskIds.length && 
                     entryTaskIds.every((id, idx) => id === existingTaskIds[idx]))
                
                // Match by description - both must be null/empty or both must be the same
                const existingDesc = entry.description?.trim() || null
                const descriptionMatch = 
                    (!entryDescription && !existingDesc) ||
                    (entryDescription && existingDesc && entryDescription === existingDesc)
                
                return taskIdsMatch && descriptionMatch
            })

            if (matchingEntry) {
                // Merge with existing entry
                const existingStart = new Date(matchingEntry.startTime)
                const existingEnd = matchingEntry.endTime ? new Date(matchingEntry.endTime) : null
                
                // Keep earliest start time
                const mergedStart = existingStart < startTime ? existingStart : startTime
                // Use latest end time
                const mergedEnd = existingEnd && existingEnd > endTime ? existingEnd : endTime

                // Add gap between sessions as a break to ensure correct net work calculation
                if (existingEnd && startTime > existingEnd) {
                    // There's a gap between existing end and new start - add it as a break
                    await prisma.timeBreak.create({
                        data: {
                            timeEntryId: matchingEntry.id,
                            startTime: existingEnd,
                            endTime: startTime,
                            reason: 'gap_between_sessions'
                        }
                    })
                } else if (existingStart && endTime < existingStart) {
                    // New session ends before existing starts - add gap as break
                    await prisma.timeBreak.create({
                        data: {
                            timeEntryId: matchingEntry.id,
                            startTime: endTime,
                            endTime: existingStart,
                            reason: 'gap_between_sessions'
                        }
                    })
                }

                // Update matching entry with merged times
                const merged = await prisma.timeEntry.update({
                    where: { id: matchingEntry.id },
                    data: {
                        startTime: mergedStart,
                        endTime: mergedEnd,
                        // Update description if provided and existing is empty
                        description: description && !matchingEntry.description ? description : undefined,
                    },
                    select: {
                        id: true,
                        userId: true,
                        startTime: true,
                        endTime: true,
                        description: true,
                        isManual: true,
                        createdAt: true,
                        updatedAt: true,
                        subtaskId: true,
                        breaks: true,
                        tasks: true,
                        subtask: {
                            select: {
                                id: true,
                                title: true
                            }
                        }
                    }
                })

                console.log("API: Merged manual entry with existing", merged.id)
                return NextResponse.json({ entry: merged, merged: true })
            } else {
                // No matching entry found, create new entry
                const entry = await prisma.timeEntry.create({
                    data: {
                        userId: session.user.id,
                        startTime: startTime,
                        endTime: endTime,
                        description,
                        isManual: true,
                        tasks: taskIds && taskIds.length > 0 ? {
                            connect: taskIds.map(id => ({ id }))
                        } : undefined,
                        subtaskId: entrySubtaskId,
                    },
                    select: {
                        id: true,
                        userId: true,
                        startTime: true,
                        endTime: true,
                        description: true,
                        isManual: true,
                        createdAt: true,
                        updatedAt: true,
                        subtaskId: true,
                        breaks: true,
                        tasks: true
                    }
                })
                console.log("API: Created entry", entry.id)
                return NextResponse.json({ entry, merged: false })
            }
        }

        return NextResponse.json({ message: "Invalid action" }, { status: 400 })

    } catch (error) {
        console.error(error)
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 })
    }
}

// PATCH: Update entry (e.g. description)
export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const payload = await req.json() as { id: string; description?: string; startTime?: string; endTime?: string; taskIds?: string[]; subtaskId?: string | null }
    const { id, description, startTime, endTime, taskIds, subtaskId } = payload

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = {}
        if (description !== undefined) data.description = description
        if (taskIds !== undefined) {
            data.tasks = {
                set: taskIds.map(tid => ({ id: tid }))
            }
        }
        if (subtaskId !== undefined) data.subtaskId = subtaskId

        if (startTime) {
            data.startTime = new Date(startTime)
            data.isManual = true
        }
        if (endTime) {
            data.endTime = new Date(endTime)
            data.isManual = true
        }

        const updated = await prisma.timeEntry.update({
            where: { id },
            data
        })

        return NextResponse.json({ entry: updated })
    } catch {
        return NextResponse.json({ message: "Error updating entry" }, { status: 500 })
    }
}

// DELETE: Delete entry
export async function DELETE(req: Request) {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!session || !session.user || !id) {
        return NextResponse.json({ message: "Unauthorized or missing ID" }, { status: 401 })
    }

    try {
        await prisma.timeEntry.delete({
            where: { id }
        })

        return NextResponse.json({ message: "Deleted" })
    } catch {
        return NextResponse.json({ message: "Error deleting entry" }, { status: 500 })
    }
}
