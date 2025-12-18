import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

// GET: Fetch currently running entry + recent history
export async function GET(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const entries = await prisma.timeEntry.findMany({
            where: { userId: session.user.id },
            include: { breaks: true },
            orderBy: { startTime: "desc" },
            take: 50, // Limit to recent 50 for dashboard performance
        })

        const activeEntry = entries.find(e => e.endTime === null)

        return NextResponse.json({ entries, activeEntry })
    } catch (error) {
        return NextResponse.json({ message: "Error fetching entries" }, { status: 500 })
    }
}

// POST: Toggle Timer (Start/Stop/Pause/Resume) or Create Manual Entry
export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { action, manualData } = await req.json() // action: 'start' | 'stop' | 'pause' | 'resume' | 'manual'

    try {
        // 1. START TIMER
        if (action === "start") {
            const active = await prisma.timeEntry.findFirst({
                where: { userId: session.user.id, endTime: null }
            })

            if (active) {
                return NextResponse.json({ message: "Timer already running" }, { status: 400 })
            }

            const newEntry = await prisma.timeEntry.create({
                data: {
                    userId: session.user.id,
                    startTime: new Date(),
                    isManual: false,
                }
            })

            return NextResponse.json({ entry: newEntry })
        }

        // 2. STOP TIMER
        if (action === "stop") {
            const active = await prisma.timeEntry.findFirst({
                where: { userId: session.user.id, endTime: null },
                include: { breaks: true }
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

            const updated = await prisma.timeEntry.update({
                where: { id: active.id },
                data: { endTime: new Date() }
            })

            return NextResponse.json({ entry: updated })
        }

        // 3. PAUSE TIMER
        if (action === "pause") {
            const active = await prisma.timeEntry.findFirst({
                where: { userId: session.user.id, endTime: null },
                include: { breaks: true }
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
                include: { breaks: true }
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
            const { start, end, description } = manualData
            const entry = await prisma.timeEntry.create({
                data: {
                    userId: session.user.id,
                    startTime: new Date(start),
                    endTime: new Date(end),
                    description,
                    isManual: true
                }
            })
            console.log("API: Created entry", entry.id)
            return NextResponse.json({ entry })
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

    const { id, description } = await req.json()

    try {
        const updated = await prisma.timeEntry.update({
            where: { id },
            data: { description }
        })

        return NextResponse.json({ entry: updated })
    } catch (error) {
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
    } catch (error) {
        return NextResponse.json({ message: "Error deleting entry" }, { status: 500 })
    }
}
