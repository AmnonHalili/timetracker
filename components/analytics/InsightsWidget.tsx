"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
            <Card>
                <CardHeader>
                    <CardTitle>💡 Your Productivity Insights</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="animate-pulse space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!insights?.hasData) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>💡 Your Productivity Insights</CardTitle>
                    <CardDescription>Start tracking to see your insights</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        We need at least a few days of data to generate insights.
                    </p>
                    <Button size="sm" asChild>
                        <Link href="/insights">
                            Learn More <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        )
    }

    const getFocusEmoji = (score: number) => {
        if (score >= 80) return "🚀"
        if (score >= 60) return "💪"
        if (score >= 40) return "👍"
        return "📈"
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <span>{getFocusEmoji(insights.scores.focus)}</span>
                    Your Productivity This Week
                </CardTitle>
                <CardDescription>
                    {insights.summary.trend.startsWith('+') ? (
                        <span className="text-green-600 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {insights.summary.trend} improvement
                        </span>
                    ) : insights.summary.trend !== "0%" ? (
                        <span className="text-amber-600">{insights.summary.trend} change</span>
                    ) : (
                        <span className="text-muted-foreground">Steady performance</span>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Hours Worked</span>
                        </div>
                        <div className="text-2xl font-bold">{insights.summary.totalHours}h</div>
                        <div className="text-xs text-muted-foreground">
                            {insights.summary.avgDailyHours}h/day avg
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Target className="h-3 w-3" />
                            <span>Tasks Done</span>
                        </div>
                        <div className="text-2xl font-bold">{insights.summary.tasksCompleted}</div>
                        <div className="text-xs text-muted-foreground">
                            {Math.round(insights.summary.tasksCompleted / 7)} per day
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Focus Score</span>
                        <span className="font-medium">{insights.scores.focus}/100</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{ width: `${insights.scores.focus}%` }}
                        />
                    </div>
                </div>

                <Button size="sm" variant="ghost" asChild className="w-full">
                    <Link href="/insights">
                        View Full Insights <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </CardContent>
        </Card>
    )
}
