"use client"

import { useState } from "react"
import { DailyReport } from "@/lib/report-calculations"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatHoursMinutes } from "@/lib/utils"
import { useLanguage } from "@/lib/useLanguage"
import { ChevronDown, ChevronUp } from "lucide-react"
import { ReportTable } from "./ReportTable"

interface UserReportData {
    userId: string
    userName: string | null
    userEmail: string
    days: DailyReport[]
    totalMonthlyHours: number
    totalTargetHours: number
}

interface AllUsersReportTableProps {
    usersData: UserReportData[]
    showWarnings?: boolean
}

export function AllUsersReportTable({ usersData, showWarnings }: AllUsersReportTableProps) {
    const { t, isRTL } = useLanguage()
    const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())

    const handleUserClick = (userId: string) => {
        setExpandedUsers(prev => {
            const next = new Set(prev)
            if (next.has(userId)) {
                next.delete(userId)
            } else {
                next.add(userId)
            }
            return next
        })
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className={cn(isRTL ? "text-right" : "text-left", "w-[30%]")}>
                            {t('reports.user')}
                        </TableHead>
                        <TableHead className={cn(isRTL ? "text-right" : "text-left", "w-[35%]")}>
                            {t('reports.totalWorked')}
                        </TableHead>
                        <TableHead className={cn(isRTL ? "text-left" : "text-right", "w-[35%]")}>
                            {t('reports.targetHours')}
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {usersData.map((userData) => {
                        const isExpanded = expandedUsers.has(userData.userId)
                        const displayName = userData.userName || userData.userEmail

                        return (
                            <>
                                <TableRow
                                    key={userData.userId}
                                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                                    onClick={() => handleUserClick(userData.userId)}
                                >
                                    <TableCell className={cn("font-medium", isRTL ? "text-right" : "text-left", "w-[30%]")}>
                                        <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                                            {isExpanded ? (
                                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                            )}
                                            {displayName}
                                        </div>
                                    </TableCell>
                                    <TableCell className={cn(isRTL ? "text-right" : "text-left", "font-mono", "w-[35%]")}>
                                        {formatHoursMinutes(userData.totalMonthlyHours)}
                                    </TableCell>
                                    <TableCell className={cn(isRTL ? "text-left" : "text-right", "font-mono", "w-[35%]")}>
                                        {formatHoursMinutes(userData.totalTargetHours)}
                                    </TableCell>
                                </TableRow>

                                {/* Expanded User Content - Show ReportTable for this user */}
                                {isExpanded && (
                                    <TableRow
                                        key={`${userData.userId}-expanded`}
                                        className="bg-muted/20"
                                    >
                                        <TableCell colSpan={3} className="p-0">
                                            <div className="p-4">
                                                <ReportTable 
                                                    days={userData.days} 
                                                    showWarnings={showWarnings} 
                                                    userId={userData.userId} 
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}

