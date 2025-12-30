"use client"
import { Card, CardContent } from "@/components/ui/card"
import { useEffect, useState } from "react"

interface StatsWidgetProps {
    extraHours: number
    remainingHours: number
    activeEntryStartTime?: Date | string | number | null
    isPaused?: boolean
}

// Format hours: Always show as HH:MMh for consistency and precision
function formatHours(hours: number, showSign: boolean = false): string {
    const isNegative = hours < 0
    const absHours = Math.abs(hours)




    // Handle edge case where rounding minutes pushes to next hour (e.g. 1.99 hours -> 1h 60m -> 2h 00m)
    const totalMinutes = Math.round(absHours * 60)
    const normalizedH = Math.floor(totalMinutes / 60)
    const normalizedM = totalMinutes % 60

    const formatted = `${normalizedH}:${normalizedM.toString().padStart(2, '0')}h`

    // Add sign prefix if needed
    if (showSign) {
        if (isNegative) {
            return `-${formatted}`
        } else if (hours > 0) {
            return `+${formatted}`
        }
    } else if (isNegative) {
        return `-${formatted}`
    }

    return formatted
}

export function StatsWidget({ extraHours, remainingHours, activeEntryStartTime, isPaused }: StatsWidgetProps) {
    // Initial balance based on server data
    // Extra is positive, Remaining is negative equivalent
    const [initialBalance, setInitialBalance] = useState(extraHours - remainingHours)
    const [currentBalance, setCurrentBalance] = useState(extraHours - remainingHours)

    useEffect(() => {
        // Re-sync if server props change (e.g. on refresh)
        const newBalance = extraHours - remainingHours
        setInitialBalance(newBalance)
        setCurrentBalance(newBalance)
    }, [extraHours, remainingHours])

    useEffect(() => {
        if (!activeEntryStartTime || isPaused) return

        const mountTime = Date.now()

        const interval = setInterval(() => {
            const now = Date.now()
            const elapsedHours = (now - mountTime) / 3600000 // Convert ms to hours
            setCurrentBalance(initialBalance + elapsedHours)
        }, 1000)

        return () => clearInterval(interval)
    }, [activeEntryStartTime, isPaused, initialBalance])

    // Derive display values from current state
    let displayExtra = 0
    let displayRemaining = 0

    if (currentBalance > 0) {
        displayExtra = currentBalance
        displayRemaining = 0
    } else if (currentBalance < 0) {
        displayExtra = 0
        displayRemaining = Math.abs(currentBalance)
    }

    return (
        <Card className="bg-muted/30 border-none shadow-none">
            <CardContent className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground uppercase tracking-wider text-xs">Extra</span>
                    <span className={displayExtra > 0 ? "font-bold" : "text-muted-foreground font-medium"}>
                        {formatHours(displayExtra, true)}
                    </span>
                </div>
                <div className="h-[1px] bg-border/50 w-full" />
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground uppercase tracking-wider text-xs">Remaining</span>
                    <span className={displayRemaining > 0 ? "font-bold" : "text-muted-foreground font-medium"}>
                        {formatHours(displayRemaining)}
                    </span>
                </div>
            </CardContent>
        </Card>
    )
}
