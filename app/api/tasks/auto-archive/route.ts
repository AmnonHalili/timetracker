import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

// This endpoint should be called by a cron job (e.g., Vercel Cron)
// It archives tasks that have been DONE for 7 days or more
export async function POST(req: Request) {
    // Optional: Add API key authentication for cron jobs
    const authHeader = req.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        // Calculate the date 7 days ago
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        sevenDaysAgo.setHours(0, 0, 0, 0) // Start of day

        // Find tasks that:
        // 1. Are marked as DONE (status = 'DONE' or isCompleted = true)
        // 2. Were updated/completed at least 7 days ago
        // 3. Are not already archived
        const tasksToArchive = await prisma.task.findMany({
            where: {
                status: 'DONE',
                isArchived: false,
                updatedAt: {
                    lte: sevenDaysAgo
                }
            },
            select: {
                id: true
            }
        })

        if (tasksToArchive.length === 0) {
            return NextResponse.json({ 
                message: "No tasks to archive",
                archived: 0,
                timestamp: new Date().toISOString()
            })
        }

        // Archive all matching tasks
        const result = await prisma.task.updateMany({
            where: {
                id: {
                    in: tasksToArchive.map(t => t.id)
                }
            },
            data: {
                isArchived: true,
                archivedAt: new Date()
            }
        })

        console.log(`Auto-archived ${result.count} tasks`)

        return NextResponse.json({ 
            message: "Tasks archived successfully",
            archived: result.count,
            timestamp: new Date().toISOString()
        })
    } catch (error) {
        console.error("Error auto-archiving tasks:", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        return NextResponse.json({ 
            message: "Error archiving tasks",
            error: errorMessage,
            timestamp: new Date().toISOString()
        }, { status: 500 })
    }
}

// Allow GET for testing (remove in production or add auth)
export async function GET() {
    return POST(new Request("http://localhost", { method: "POST" }))
}

