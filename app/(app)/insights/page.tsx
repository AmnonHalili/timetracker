"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, TrendingUp, Target, Coffee, Calendar, AlertTriangle, Loader2 } from "lucide-react"
import { useSession } from "next-auth/react"

interface PersonalInsights {
    summary: {
        period: string
        totalHours: number
        avgDailyHours: number
        tasksCompleted: number
        focusScore: number
        trend: string
        daysWithData: number
    }
    peakHours: {
        start: number
        end: number
        confidence: number
        avgProductivity: number
    } | null
    patterns: {
        mostProductiveDay: string
        leastProductiveDay: string
        averageSessionLength: number
        longestSession: number
        breaksPerDay: number
    }
    scores: {
        focus: number
        efficiency: number
        balance: number
    }
    burnout: {
        risk: boolean
        consecutiveDays: number
        overtimeHours: number
    }
    hasData: boolean
}

export default function InsightsPage() {
    const { data: session } = useSession()
    const [insights, setInsights] = useState<PersonalInsights | null>(null)
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)

    useEffect(() => {
        fetchInsights()
    }, [])

    const fetchInsights = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/analytics/personal?days=30')
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

    const generateSnapshot = async (backfill: boolean = false) => {
        setGenerating(true)
        try {
            const res = await fetch('/api/analytics/snapshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ backfill, days: backfill ? 30 : undefined })
            })

            if (res.ok) {
                // Refresh insights after generation
                await fetchInsights()
            }
        } catch (error) {
            console.error("Failed to generate snapshot:", error)
        } finally {
            setGenerating(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!insights?.hasData) {
        return (
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">💡 Productivity Insights</h1>
                    <p className="text-muted-foreground mt-2">
                        Get personalized insights about your work patterns
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>No Data Yet</CardTitle>
                        <CardDescription>
                            We need some time tracking data to generate insights
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Start tracking your time, and we'll analyze your patterns to provide:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            <li>Your most productive hours</li>
                            <li>Focus and efficiency scores</li>
                            <li>Work-life balance analysis</li>
                            <li>Burnout risk detection</li>
                            <li>Personalized recommendations</li>
                        </ul>

                        {insights && insights.summary && insights.summary.daysWithData > 0 && (
                            <div className="pt-4">
                                <p className="text-sm mb-4">
                                    You have {insights.summary.daysWithData} days of recent data. Click below to generate insights:
                                </p>
                                <Button onClick={() => generateSnapshot(true)} disabled={generating}>
                                    {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Generate Insights from Last 30 Days
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        )
    }

    const getScoreColor = (score: number) => {
        if (score >= 80) return "text-green-600"
        if (score >= 60) return "text-blue-600"
        if (score >= 40) return "text-amber-600"
        return "text-red-600"
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">💡 Your Productivity Insights</h1>
                    <p className="text-muted-foreground mt-1">
                        Based on last {insights.summary.daysWithData} days
                    </p>
                </div>
                <Button onClick={() => generateSnapshot()} disabled={generating} variant="outline">
                    {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Refresh Data
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Total Hours
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{insights.summary.totalHours}h</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {insights.summary.avgDailyHours}h per day average
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            Tasks Completed
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{insights.summary.tasksCompleted}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {Math.round(insights.summary.tasksCompleted / insights.summary.daysWithData * 7)} per week
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            Trend
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${insights.summary.trend.startsWith('+') ? 'text-green-600' : 'text-amber-600'}`}>
                            {insights.summary.trend}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            vs previous period
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Burnout Warning */}
            {insights.burnout.risk && (
                <Card className="border-red-200 bg-red-50">
                    <CardHeader>
                        <CardTitle className="text-red-700 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Burnout Risk Detected
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <p className="text-sm text-red-700">
                            You've worked {insights.burnout.consecutiveDays} consecutive days with {insights.burnout.overtimeHours.toFixed(1)}h overtime.
                        </p>
                        <p className="text-sm text-red-600">
                            Consider taking a break or reducing your workload.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Peak Hours */}
            {insights.peakHours && (
                <Card>
                    <CardHeader>
                        <CardTitle>⏰ Your Peak Hours</CardTitle>
                        <CardDescription>
                            When you're most productive
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-3xl font-bold">
                                    {insights.peakHours.start}:00 - {insights.peakHours.end}:00
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {insights.peakHours.confidence}% confidence
                                </p>
                            </div>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-900">
                                💡 <strong>Recommendation:</strong> Schedule your most important tasks between {insights.peakHours.start}:00 and {insights.peakHours.end}:00 for maximum productivity.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Productivity Scores */}
            <Card>
                <CardHeader>
                    <CardTitle>📊 Productivity Scores</CardTitle>
                    <CardDescription>
                        Based on your work patterns
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm font-medium">Focus Score</span>
                                <span className={`text-sm font-bold ${getScoreColor(insights.scores.focus)}`}>
                                    {insights.scores.focus}/100
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all"
                                    style={{ width: `${insights.scores.focus}%` }}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm font-medium">Efficiency Score</span>
                                <span className={`text-sm font-bold ${getScoreColor(insights.scores.efficiency)}`}>
                                    {insights.scores.efficiency}/100
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-green-600 h-2 rounded-full transition-all"
                                    style={{ width: `${insights.scores.efficiency}%` }}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm font-medium">Work-Life Balance</span>
                                <span className={`text-sm font-bold ${getScoreColor(insights.scores.balance)}`}>
                                    {insights.scores.balance}/100
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-purple-600 h-2 rounded-full transition-all"
                                    style={{ width: `${insights.scores.balance}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Work Patterns */}
            <Card>
                <CardHeader>
                    <CardTitle>📅 Work Patterns</CardTitle>
                    <CardDescription>
                        Your typical work habits
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <div className="text-sm text-muted-foreground">Most Productive Day</div>
                            <div className="text-lg font-semibold">{insights.patterns.mostProductiveDay}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-sm text-muted-foreground">Average Session</div>
                            <div className="text-lg font-semibold">{insights.patterns.averageSessionLength} min</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <Coffee className="h-3 w-3" />
                                Breaks Per Day
                            </div>
                            <div className="text-lg font-semibold">{insights.patterns.breaksPerDay.toFixed(1)}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-sm text-muted-foreground">Longest Session</div>
                            <div className="text-lg font-semibold">{Math.round(insights.patterns.longestSession / 60)} hours</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-sm text-muted-foreground">Least Productive Day</div>
                            <div className="text-lg font-semibold">{insights.patterns.leastProductiveDay}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
