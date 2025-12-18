import { Card } from "@/components/ui/card"

interface StatsWidgetProps {
    extraHours: number
    remainingHours: number
}

export function StatsWidget({ extraHours, remainingHours }: StatsWidgetProps) {
    // Format numbers to 2 decimal places if needed, or keeping it simple as per design
    // Design shows labels: "Extra hours:", "Remaining Hours:" with values.
    // Assuming values are effectively passed already formatted or we format them here.

    return (
        <Card className="w-fit min-w-[250px] p-4 bg-muted/40 border-none shadow-none rounded-none">
            <div className="grid gap-2">
                <div className="flex justify-between items-center text-sm gap-8">
                    <span className="font-medium text-muted-foreground whitespace-nowrap">Extra hours:</span>
                    <span className="font-normal">{extraHours.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm gap-8">
                    <span className="font-medium text-muted-foreground whitespace-nowrap">Remaining Hours:</span>
                    <span className="font-normal">{remainingHours > 0 ? remainingHours.toFixed(2) : "0.00"}</span>
                </div>
            </div>
        </Card>
    )
}
