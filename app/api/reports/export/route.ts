import { authOptions } from "@/lib/auth"
import { getReportData } from "@/lib/report-service"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { format, getDay } from "date-fns"
import ExcelJS from "exceljs"
import { filterVisibleUsers } from "@/lib/hierarchy-utils"

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
    const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true, projectId: true }
    })

    if (!currentUser) return new NextResponse("Unauthorized", { status: 401 })

    // Handle "all users" export - only for ADMIN or MANAGER
    if (userId === "all") {
        if (!["ADMIN", "MANAGER"].includes(currentUser.role) || !currentUser.projectId) {
            return new NextResponse("Forbidden", { status: 403 })
        }

        // Fetch all active users in the project
        const allProjectUsers = await prisma.user.findMany({
            where: {
                projectId: currentUser.projectId,
                status: "ACTIVE"
            },
            select: { id: true, name: true, email: true, managerId: true, role: true },
            orderBy: { name: "asc" }
        })

        // Fetch secondary manager relationships
        const allSecondaryRelations = await prisma.secondaryManager.findMany({
            where: {
                OR: [
                    { managerId: currentUser.id },
                    { employeeId: currentUser.id }
                ]
            },
            select: {
                employeeId: true,
                managerId: true,
                permissions: true
            }
        })

        const secondaryRelations = allSecondaryRelations.filter(rel =>
            rel.managerId === currentUser.id && rel.permissions.includes('VIEW_TIME')
        )

        // Filter based on hierarchy + secondary manager relationships
        const visibleUsers = filterVisibleUsers(allProjectUsers, { id: currentUser.id, role: currentUser.role }, secondaryRelations)

        if (visibleUsers.length === 0) {
            return new NextResponse("No users found", { status: 404 })
        }

        // Create Excel workbook with multiple sheets (one per user)
        const workbook = new ExcelJS.Workbook()

        // Helper function to create a worksheet for a user
        const createUserSheet = async (targetUserId: string) => {
            const userData = await getReportData(targetUserId, parseInt(year), parseInt(month))
            if (!userData) return null

            const { report, user } = userData
            const sheetName = (user.name || user.email || 'User').substring(0, 31) // Excel sheet name limit
            const worksheet = workbook.addWorksheet(sheetName)

            // Format hours to display as hours and minutes
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

            // Get day name
            const getDayName = (date: Date): string => {
                const dayOfWeek = getDay(date)
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                return dayNames[dayOfWeek]
            }

            // Prepare data
            const headers = ["Date", "Day", "Start Time", "End Time", "Total Hours"]
            
            // Add header row
            const headerRow = worksheet.addRow(headers)
            headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
            headerRow.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF4472C4" }
            }
            headerRow.alignment = { vertical: "middle", horizontal: "left" }
            headerRow.height = 25
            
            headerRow.eachCell((cell) => {
                cell.border = {
                    top: { style: "thin", color: { argb: "FF000000" } },
                    bottom: { style: "thin", color: { argb: "FF000000" } },
                    left: { style: "thin", color: { argb: "FF000000" } },
                    right: { style: "thin", color: { argb: "FF000000" } }
                }
            })

            // Add data rows
            report.days.forEach((day) => {
                const date = format(day.date, "dd/MM/yyyy")
                const dayName = getDayName(day.date)
                const startTime = day.startTime ? format(day.startTime, "HH:mm") : "-"
                const endTime = day.endTime 
                    ? format(day.endTime, "HH:mm") 
                    : (day.startTime ? "Running..." : "-")
                const totalHours = formatHoursMinutes(day.totalDurationHours)

                const row = worksheet.addRow([date, dayName, startTime, endTime, totalHours])
                
                const isNonWorkDay = !day.isWorkDay
                
                row.eachCell((cell, colNumber) => {
                    if (colNumber === 1) {
                        cell.font = { bold: true, size: 11, color: { argb: "FF333333" } }
                    } else if (colNumber === 5) {
                        cell.font = { name: "Courier New", size: 11, color: { argb: "FF333333" } }
                        cell.alignment = { vertical: "middle", horizontal: "right" }
                    } else {
                        cell.font = { size: 11, color: { argb: "FF333333" } }
                        cell.alignment = { vertical: "middle", horizontal: "left" }
                    }
                    
                    if (isNonWorkDay) {
                        cell.fill = {
                            type: "pattern",
                            pattern: "solid",
                            fgColor: { argb: "FFF5F5F5" }
                        }
                    }
                    
                    cell.border = {
                        top: { style: "thin", color: { argb: "FFE0E0E0" } },
                        bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
                        left: { style: "thin", color: { argb: "FFE0E0E0" } },
                        right: { style: "thin", color: { argb: "FFE0E0E0" } }
                    }
                })
                
                row.height = 20
            })

            // Set column widths
            worksheet.getColumn(1).width = 12
            worksheet.getColumn(2).width = 12
            worksheet.getColumn(3).width = 12
            worksheet.getColumn(4).width = 12
            worksheet.getColumn(5).width = 12

            return user
        }

        // Create sheets for all visible users
        for (const user of visibleUsers) {
            await createUserSheet(user.id)
        }

        // Generate Excel file buffer
        const buffer = await workbook.xlsx.writeBuffer()

        // Return Excel file
        return new NextResponse(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="report-all-users-${month}-${year}.xlsx"`
            }
        })
    }

    // Single user export - existing logic
    // If viewing someone else, MUST be admin/manager and share project
    if (userId !== currentUser.id) {
        if (!["ADMIN", "MANAGER"].includes(currentUser.role)) {
            return new NextResponse("Forbidden", { status: 403 })
        }
        
        // Verify target user is visible (same project and in hierarchy)
        if (currentUser.projectId) {
            const allProjectUsers = await prisma.user.findMany({
                where: {
                    projectId: currentUser.projectId,
                    status: "ACTIVE"
                },
                select: { id: true, name: true, email: true, managerId: true, role: true },
            })

            const allSecondaryRelations = await prisma.secondaryManager.findMany({
                where: {
                    OR: [
                        { managerId: currentUser.id },
                        { employeeId: currentUser.id }
                    ]
                },
                select: {
                    employeeId: true,
                    managerId: true,
                    permissions: true
                }
            })

            const secondaryRelations = allSecondaryRelations.filter(rel =>
                rel.managerId === currentUser.id && rel.permissions.includes('VIEW_TIME')
            )

            const visibleUsers = filterVisibleUsers(allProjectUsers, { id: currentUser.id, role: currentUser.role }, secondaryRelations)
            
            if (!visibleUsers.find(u => u.id === userId)) {
                return new NextResponse("Forbidden", { status: 403 })
            }
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

    // Create Excel workbook with ExcelJS
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Time Report")

    // Prepare data - exactly matching the on-screen report
    const headers = ["Date", "Day", "Start Time", "End Time", "Total Hours"]
    
    // Add header row with professional styling
    const headerRow = worksheet.addRow(headers)
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
    headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" } // Blue background
    }
    headerRow.alignment = { vertical: "middle", horizontal: "left" }
    headerRow.height = 25
    
    // Style header cells with borders
    headerRow.eachCell((cell) => {
        cell.border = {
            top: { style: "thin", color: { argb: "FF000000" } },
            bottom: { style: "thin", color: { argb: "FF000000" } },
            left: { style: "thin", color: { argb: "FF000000" } },
            right: { style: "thin", color: { argb: "FF000000" } }
        }
    })

    // Add data rows - exactly like ReportTable component
    report.days.forEach((day) => {
        const date = format(day.date, "dd/MM/yyyy")
        const dayName = getDayName(day.date)
        const startTime = day.startTime ? format(day.startTime, "HH:mm") : "-"
        const endTime = day.endTime 
            ? format(day.endTime, "HH:mm") 
            : (day.startTime ? "Running..." : "-")
        const totalHours = formatHoursMinutes(day.totalDurationHours)

        const row = worksheet.addRow([date, dayName, startTime, endTime, totalHours])
        
        // Style data row
        const isNonWorkDay = !day.isWorkDay
        
        row.eachCell((cell, colNumber) => {
            // Date column - bold
            if (colNumber === 1) {
                cell.font = { bold: true, size: 11, color: { argb: "FF333333" } }
            }
            // Total Hours column - monospace font, right-aligned
            else if (colNumber === 5) {
                cell.font = { name: "Courier New", size: 11, color: { argb: "FF333333" } }
                cell.alignment = { vertical: "middle", horizontal: "right" }
            }
            // Other columns
            else {
                cell.font = { size: 11, color: { argb: "FF333333" } }
                cell.alignment = { vertical: "middle", horizontal: "left" }
            }
            
            // Background color for non-work days
            if (isNonWorkDay) {
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFF5F5F5" } // Light gray
                }
            }
            
            // Borders for all cells
            cell.border = {
                top: { style: "thin", color: { argb: "FFE0E0E0" } },
                bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
                left: { style: "thin", color: { argb: "FFE0E0E0" } },
                right: { style: "thin", color: { argb: "FFE0E0E0" } }
            }
        })
        
        row.height = 20
    })

    // Set column widths for better readability
    worksheet.getColumn(1).width = 12 // Date
    worksheet.getColumn(2).width = 12 // Day
    worksheet.getColumn(3).width = 12 // Start Time
    worksheet.getColumn(4).width = 12 // End Time
    worksheet.getColumn(5).width = 12 // Total Hours

    // Generate Excel file buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Return Excel file
    return new NextResponse(buffer, {
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="report-${user.name || 'user'}-${month}-${year}.xlsx"`
        }
    })
}
