import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { deleteTaskAttachments } from "@/lib/s3-cleanup"

// This endpoint should be called by a cron job (e.g., Vercel Cron)
// It performs comprehensive data cleanup based on retention policies
export async function POST(req: Request) {
    // Optional: Add API key authentication for cron jobs
    const authHeader = req.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const results = {
        notifications: 0,
        sessions: 0,
        verificationTokens: 0,
        taskActivities: 0,
        analyticsSnapshots: 0,
        recommendations: 0,
        events: 0,
        workdays: 0,
        archivedTasks: 0,
        archivedTaskAttachments: 0,
        oldTimeEntries: 0,
        newlyArchivedTasks: 0
    }

    try {
        const now = new Date()

        // 0. Auto-archive old DONE tasks (previously in separate cron)
        // Archives tasks that have been DONE for 7 days or more
        const archiveThresholdDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        archiveThresholdDate.setHours(0, 0, 0, 0) // Start of day

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tasksToArchive = await (prisma.task as any).findMany({
            where: {
                status: 'DONE',
                isArchived: false,
                updatedAt: { lte: archiveThresholdDate }
            },
            select: { id: true }
        })

        if (tasksToArchive.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (prisma.task as any).updateMany({
                where: {
                    id: { in: tasksToArchive.map((t: { id: string }) => t.id) }
                },
                data: {
                    isArchived: true,
                    archivedAt: now
                }
            })
            // Log for debugging/results (we'll add a field to results object below)
        }

        // - Read notifications older than 7 days
        // - Unread notifications older than 30 days
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

        results.notifications = await prisma.notification.deleteMany({
            where: {
                OR: [
                    { isRead: true, createdAt: { lte: sevenDaysAgo } },
                    { isRead: false, createdAt: { lte: thirtyDaysAgo } }
                ]
            }
        }).then(r => r.count)

        // 2. Delete expired sessions
        results.sessions = await prisma.session.deleteMany({
            where: {
                expires: { lt: now }
            }
        }).then(r => r.count)

        // 3. Delete expired verification tokens
        results.verificationTokens = await prisma.verificationToken.deleteMany({
            where: {
                expires: { lt: now }
            }
        }).then(r => r.count)

        // 4. Delete old task activities (90 days)
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        results.taskActivities = await prisma.taskActivity.deleteMany({
            where: {
                createdAt: { lte: ninetyDaysAgo }
            }
        }).then(r => r.count)

        // 5. Delete old analytics snapshots (keep last 1 year)
        // Analytics snapshots are summaries, so we keep them longer for historical analysis
        // Future: Implement aggregation before deletion for even older snapshots
        const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        results.analyticsSnapshots = await prisma.analyticsSnapshot.deleteMany({
            where: {
                date: { lt: oneYearAgo }
            }
        }).then(r => r.count)

        // 6. Delete dismissed recommendations (30 days old)
        results.recommendations = await prisma.recommendation.deleteMany({
            where: {
                dismissed: true,
                createdAt: { lte: thirtyDaysAgo }
            }
        }).then(r => r.count)

        // 7. Delete old events (1 year old, non-recurring only)
        results.events = await prisma.event.deleteMany({
            where: {
                endTime: { lt: oneYearAgo },
                recurrence: null // Don't delete recurring events
            }
        }).then(r => r.count)

        // 8. Delete old workdays (5 years old)
        // Workdays are critical for historical reports, so we keep them longer
        // Users can view reports for any month/year, so we need to preserve this data
        const fiveYearsAgo = new Date(now.getTime() - 1825 * 24 * 60 * 60 * 1000)
        results.workdays = await prisma.workday.deleteMany({
            where: {
                workdayStartTime: { lt: fiveYearsAgo }
            }
        }).then(r => r.count)

        // 9. Permanently delete archived tasks older than 1 year
        // Note: This will cascade delete related data (attachments, notes, etc.)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const oldArchivedTasks = await (prisma.task as any).findMany({
            where: {
                isArchived: true,
                archivedAt: {
                    lte: oneYearAgo,
                    not: null
                }
            },
            select: { id: true }
        })

        if (oldArchivedTasks.length > 0) {
            const taskIds = oldArchivedTasks.map((t: { id: string }) => t.id)

            // Delete attachments from S3 first (before DB deletion)
            try {
                results.archivedTaskAttachments = await deleteTaskAttachments(taskIds)
            } catch (error) {
                console.error("Error deleting task attachments from S3:", error)
                // Continue with DB deletion even if S3 cleanup fails
            }

            // Delete tasks (cascade will handle related data in DB)
            results.archivedTasks = await prisma.task.deleteMany({
                where: {
                    id: { in: taskIds }
                }
            }).then(r => r.count)
        }

        // 10. Delete very old time entries (5 years old, completed only)
        // Time entries are critical for historical reports, so we keep them longer
        // Users can view reports for any month/year, so we need to preserve this data
        // Only delete completed entries (endTime not null) to avoid breaking active sessions
        results.oldTimeEntries = await prisma.timeEntry.deleteMany({
            where: {
                startTime: { lt: fiveYearsAgo },
                endTime: { not: null } // Only completed entries
            }
        }).then(r => r.count)

        return NextResponse.json({
            message: "Cleanup completed successfully",
            results,
            timestamp: now.toISOString()
        })
    } catch (error) {
        console.error("Error during cleanup:", error)
        return NextResponse.json({
            message: "Error during cleanup",
            error: error instanceof Error ? error.message : "Unknown error",
            partialResults: results
        }, { status: 500 })
    }
}

// Allow GET for testing (remove in production or add auth)
export async function GET() {
    return POST(new Request("http://localhost", { method: "POST" }))
}
