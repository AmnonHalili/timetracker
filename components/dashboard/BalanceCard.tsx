import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface BalanceCardProps {
    balance: number // in hours
    dailyTarget: number
}

export function BalanceCard({ balance, dailyTarget }: BalanceCardProps) {
    const isPositive = balance >= 0
    const formattedBalance = Math.abs(balance).toFixed(2)

    return (
        <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    Current Balance
                </CardTitle>
                <span className="text-xs text-muted-foreground">Target: {dailyTarget}h/day</span>
            </CardHeader>
            <CardContent>
                <div className={cn(
                    "text-4xl font-bold",
                    isPositive ? "text-green-600" : "text-red-500"
                )}>
                    {isPositive ? "+" : "-"}{formattedBalance} <span className="text-lg text-muted-foreground font-medium">hrs</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                    {isPositive ? "You are ahead of schedule! 🚀" : "Missing hours to reach target 📉"}
                </p>
            </CardContent>
        </Card>
    )
}
