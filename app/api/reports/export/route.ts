import { authOptions } from "@/lib/auth"
import { getReportData } from "@/lib/report-service"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { format, getDay } from "date-fns"

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

    // Format hours to display as hours and minutes (same as in ReportTable)
    const formatHoursMinutes = (hours: number): string => {
        if (hours <= 0) return "-"
        const totalMinutes = Math.round(hours * 60)
        if (totalMinutes < 60) {
            return `${totalMinutes}m`
        }
        const h = Math.floor(totalMinutes / 60)
        const m = totalMinutes % 60
        if (m === 0) {
            return `${h}h`
        }
        return `${h}h ${m}m`
    }

    // Get day name (same logic as ReportTable)
    const getDayName = (date: Date): string => {
        const dayOfWeek = getDay(date)
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        return dayNames[dayOfWeek]
    }

    // Escape HTML special characters
    const escapeHtml = (val: string | null | undefined): string => {
        if (!val) return ""
        return String(val)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
    }

    // Generate HTML table - matching exactly what's shown on screen
    const headers = ["Date", "Day", "Start Time", "End Time", "Total Hours"]
    
    // Build table rows - exactly like ReportTable component
    const tableRows = report.days.map(day => {
        const date = format(day.date, "dd/MM/yyyy")
        const dayName = getDayName(day.date)
        const startTime = day.startTime ? format(day.startTime, "HH:mm") : "-"
        const endTime = day.endTime 
            ? format(day.endTime, "HH:mm") 
            : (day.startTime ? "Running..." : "-")
        const totalHours = formatHoursMinutes(day.totalDurationHours)

        return `    <tr${!day.isWorkDay ? ' style="background-color: #f5f5f5;"' : ''}>
        <td style="font-weight: 500;">${escapeHtml(date)}</td>
        <td>${escapeHtml(dayName)}</td>
        <td>${escapeHtml(startTime)}</td>
        <td>${escapeHtml(endTime)}</td>
        <td style="font-family: monospace; text-align: right;">${escapeHtml(totalHours)}</td>
    </tr>`
    }).join("\n")

    // Build HTML table with clean, professional styling for Word
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 20px;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            font-size: 11pt;
            border: 1px solid #e0e0e0;
        }
        th {
            background-color: #f8f9fa;
            color: #1a1a1a;
            font-weight: 600;
            padding: 12px 16px;
            text-align: left;
            border-bottom: 2px solid #e0e0e0;
            border-right: 1px solid #e0e0e0;
        }
        th:last-child {
            border-right: none;
        }
        td {
            padding: 10px 16px;
            border-bottom: 1px solid #e0e0e0;
            border-right: 1px solid #e0e0e0;
            color: #333;
        }
        td:last-child {
            border-right: none;
        }
        tr:last-child td {
            border-bottom: none;
        }
        tr:hover {
            background-color: #f8f9fa;
        }
    </style>
</head>
<body>
    <table>
        <thead>
            <tr>
${headers.map(h => `                <th>${escapeHtml(h)}</th>`).join("\n")}
            </tr>
        </thead>
        <tbody>
${tableRows}
        </tbody>
    </table>
</body>
</html>`

    return new NextResponse(htmlContent, {
        headers: {
            "Content-Type": "application/vnd.ms-word; charset=utf-8",
            "Content-Disposition": `attachment; filename="report-${user.name}-${month}-${year}.doc"`
        }
    })
}
