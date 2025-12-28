"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, TrendingUp, Clock, Target } from "lucide-react"
import Link from "next/link"

interface PersonalInsights {
    summary: {
        totalHours: number
        avgDailyHours: number
        tasksCompleted: number
        focusScore: number
        trend: string
    }
    scores: {
        focus: number
        efficiency: number
        balance: number
    }
    hasData: boolean
}

export function InsightsWidget() {
    const [insights, setInsights] = useState<PersonalInsights | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchInsights()
    }, [])

    const fetchInsights = async () => {
        try {
            const res = await fetch('/api/analytics/personal?days=7')
            if (res.ok) {
                const data = await res.json()
                setInsights(data)
            }
        } catch (error) {
            console.error("Failed to fetch insights:", error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="flex border rounded-lg p-3 bg-muted/20 items-center justify-between">
                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-8 animate-pulse"></div>
            </div>
        )
    }

    if (!insights?.hasData) {
        return (
            <div className="flex border rounded-lg p-3 bg-muted/20 items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <span>💡</span>
                    <span>Start tracking time to see AI insights</span>
                </div>
                <Button size="sm" variant="ghost" className="h-6 text-xs" asChild>
                    <Link href="/insights">
                        Learn More <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                </Button>
            </div>
        )
    }

    return (
        <Card className="shadow-sm">
            <CardContent className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4 items-center">
                <div className="hidden lg:block">
                    <h3 className="text-sm font-medium text-muted-foreground">Productivity</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-lg font-bold">
                            {insights.summary.trend.startsWith('+') ? '+' : ''}{insights.summary.trend}
                        </span>
                        {insights.summary.trend.startsWith('+') ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                            <span className="text-muted-foreground text-xs">vs last week</span>
                        )}
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Hours</span>
                    </div>
                    <div className="text-lg font-bold leading-none">
                        {insights.summary.totalHours}h
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Target className="h-3 w-3" />
                        <span>Tasks</span>
                    </div>
                    <div className="text-lg font-bold leading-none">
                        {insights.summary.tasksCompleted}
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button size="sm" variant="ghost" className="h-8 text-xs" asChild>
                        <Link href="/insights">
                            Full Report <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
