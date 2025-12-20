import { authOptions } from "@/lib/auth"
import { getReportData } from "@/lib/report-service"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { format } from "date-fns"

export async function GET(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId")
    const month = searchParams.get("month")
    const year = searchParams.get("year")

    if (!userId || !month || !year) {
        return new NextResponse("Missing parameters", { status: 400 })
    }

    // Security Check: Same as Report Page
    // A user can export ONLY if they are Admin (Project Manager) OR it's their own report
    const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true, projectId: true }
    })

    if (!currentUser) return new NextResponse("Unauthorized", { status: 401 })

    // If viewing someone else, MUST be admin and share project
    if (userId !== currentUser.id) {
        if (currentUser.role !== "ADMIN") {
            return new NextResponse("Forbidden", { status: 403 })
        }
        // Verify target user is in same project
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { projectId: true }
        })

        if (targetUser?.projectId !== currentUser.projectId) {
            return new NextResponse("Forbidden", { status: 403 })
        }
    }

    // Fetch Data
    const data = await getReportData(userId, parseInt(year), parseInt(month))

    if (!data) {
        return new NextResponse("Not Found", { status: 404 })
    }

    const { report, user } = data

    // Generate CSV
    const headers = ["Date", "Day", "Employee", "Start Time", "End Time", "Duration (Hrs)", "Status", "Is Manual", "Notes"]
    const rows = report.days.map(day => {
        const date = format(day.date, "yyyy-MM-dd")
        const dayName = day.dayName
        const employeeName = user.name || user.email
        const startTime = day.startTime ? format(day.startTime, "HH:mm") : ""
        const endTime = day.endTime ? format(day.endTime, "HH:mm") : ""
        const duration = day.totalDurationHours.toFixed(2)
        const status = day.status
        const isManual = day.hasManualEntries ? "Yes" : "No"

        // Notes could be complex if multiple entries have descriptions. joining them.
        // We'll need to fetch the raw entries for this day to get descriptions if 'day' object doesn't have them aggregated.
        // Ideally 'getReportData' returns raw entries too or 'DailyReport' has them. 
        // Currently 'DailyReport' doesn't have descriptions.
        // For V1, let's leave notes empty or generic. Or better, update 'DailyReport' later.
        // Wait, 'user.timeEntries' IS available in the scope of 'getReportData' but strictly speaking 'report.days' is the processed view.
        // Let's iterate the raw 'user.timeEntries' again for descriptions? Or just omit notes for now to keep it simple as agreed? 
        // User asked for "Professional". Professional usually implies notes.
        // Let's filter 'user.timeEntries' for this day here.

        const dayEntries = user.timeEntries.filter(e => {
            const eDate = new Date(e.startTime)
            return eDate.getDate() === day.date.getDate() &&
                eDate.getMonth() === day.date.getMonth() &&
                eDate.getFullYear() === day.date.getFullYear()
        })

        const notes = dayEntries.map(e => e.description).filter(Boolean).join("; ")

        // Escape specific chars for CSV
        const escape = (val: string) => `"${val.replace(/"/g, '""')}"`

        return [
            date,
            dayName,
            escape(employeeName),
            startTime,
            endTime,
            duration,
            status,
            isManual,
            escape(notes)
        ].join(",")
    })

    const csvContent = [headers.join(","), ...rows].join("\n")
    const BOM = "\uFEFF" // Add BOM for Excel to open UTF-8 correctly

    return new NextResponse(BOM + csvContent, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="report-${user.name}-${month}-${year}.csv"`
        }
    })
}
