import { Card, CardContent } from "@/components/ui/card"

interface StatsWidgetProps {
    extraHours: number
    remainingHours: number
}

export function StatsWidget({ extraHours, remainingHours }: StatsWidgetProps) {
    return (
        <Card className="bg-muted/30 border-none shadow-none">
            <CardContent className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground uppercase tracking-wider text-xs">Extra</span>
                    <span className={extraHours >= 0 ? "font-bold" : "text-red-500 font-bold"}>
                        {extraHours > 0 ? '+' : ''}{extraHours.toFixed(2)}h
                    </span>
                </div>
                <div className="h-[1px] bg-border/50 w-full" />
                <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground uppercase tracking-wider text-xs">Remaining</span>
                    <span className="font-bold">
                        {remainingHours.toFixed(2)}h
                    </span>
                </div>
            </CardContent>
        </Card>
    )
}
