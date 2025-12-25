import { Card, CardContent } from "@/components/ui/card"

interface StatsWidgetProps {
    extraHours: number
    remainingHours: number
}

// Format hours: if less than 1 hour, show minutes; if 1+ hours, show as H:MMh
function formatHours(hours: number, showSign: boolean = false): string {
    const isNegative = hours < 0
    const totalMinutes = Math.round(Math.abs(hours) * 60)
    
    let formatted: string
    if (totalMinutes < 60) {
        // Less than 1 hour - show minutes
        formatted = `${totalMinutes}min`
    } else {
        // 1+ hours - show as H:MMh
        const h = Math.floor(totalMinutes / 60)
        const m = totalMinutes % 60
        formatted = `${h}:${m.toString().padStart(2, '0')}h`
    }
    
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

export function StatsWidget({ extraHours, remainingHours }: StatsWidgetProps) {
    return (
        <Card className="bg-muted/30 border-none shadow-none">
            <CardContent className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground uppercase tracking-wider text-xs">Extra</span>
                    <span className={extraHours >= 0 ? "font-bold" : "text-red-500 font-bold"}>
                        {formatHours(extraHours, true)}
                    </span>
                </div>
                <div className="h-[1px] bg-border/50 w-full" />
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground uppercase tracking-wider text-xs">Remaining</span>
                    <span className="font-bold">
                        {formatHours(remainingHours)}
                    </span>
                </div>
            </CardContent>
        </Card>
    )
}
