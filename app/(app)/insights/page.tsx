"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, TrendingUp, Target, Coffee, AlertTriangle, Loader2 } from "lucide-react"

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

import { useLanguage } from "@/lib/useLanguage"

export default function InsightsPage() {
    const { t, dir } = useLanguage()
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
            <div className="max-w-4xl mx-auto space-y-6" dir={dir}>
                <div>
                    <h1 className="text-3xl font-bold">💡 {t('insights.title')}</h1>
                    <p className="text-muted-foreground mt-2">
                        {t('insights.subtitle')}
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('insights.noData')}</CardTitle>
                        <CardDescription>
                            {t('insights.needData')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            {t('insights.needDataDesc')}
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            <li>{t('insights.feature1')}</li>
                            <li>{t('insights.feature2')}</li>
                            <li>{t('insights.feature3')}</li>
                            <li>{t('insights.feature4')}</li>
                            <li>{t('insights.feature5')}</li>
                        </ul>

                        {insights && insights.summary && insights.summary.daysWithData > 0 && (
                            <div className="pt-4">
                                <p className="text-sm mb-4">
                                    {t('insights.recentData')}
                                </p>
                                <Button onClick={() => generateSnapshot(true)} disabled={generating}>
                                    {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {t('insights.generate')}
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

    const translateDay = (day: string) => {
        if (!day) return day
        const key = `days.${day.toLowerCase()}` as any
        return t(key) !== key ? t(key) : day
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6" dir={dir}>
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">💡 {t('insights.yourInsights')}</h1>
                    <p className="text-muted-foreground mt-1">
                        {t('insights.basedOn').replace(dir === 'rtl' ? 'ימים' : 'days', `${insights.summary.daysWithData} ${dir === 'rtl' ? 'ימים' : 'days'}`)}
                    </p>
                </div>
                <Button onClick={() => generateSnapshot()} disabled={generating} variant="outline">
                    {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('insights.refresh')}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {t('insights.totalHours')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{insights.summary.totalHours}h</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {insights.summary.avgDailyHours} {t('insights.avgDaily')}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            {t('insights.tasksCompleted')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{insights.summary.tasksCompleted}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {Math.round(insights.summary.tasksCompleted / insights.summary.daysWithData * 7)} {t('insights.perWeek')}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            {t('insights.trend')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${insights.summary.trend.startsWith('+') ? 'text-green-600' : 'text-amber-600'}`} dir="ltr">
                            {insights.summary.trend}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t('insights.vsPrevious')}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {insights.burnout.risk && (
                <Card className="border-red-200 bg-red-50">
                    <CardHeader>
                        <CardTitle className="text-red-700 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            {t('insights.burnoutRisk')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <p className="text-sm text-red-700">
                            {t('insights.burnoutDesc')}
                        </p>
                        <p className="text-sm text-red-600">
                            {t('insights.burnoutAction')}
                        </p>
                    </CardContent>
                </Card>
            )}

            {insights.peakHours && (
                <Card>
                    <CardHeader>
                        <CardTitle>{t('insights.peakHours')}</CardTitle>
                        <CardDescription>
                            {t('insights.peakHoursDesc')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-3xl font-bold" dir="ltr">
                                    {insights.peakHours.start}:00 - {insights.peakHours.end}:00
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {insights.peakHours.confidence}% {t('insights.confidence')}
                                </p>
                            </div>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-900">
                                💡 <strong>{t('insights.recommendation')}:</strong> {t('insights.recommendationDesc')}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>📊 {t('insights.productivityScores')}</CardTitle>
                    <CardDescription>
                        {t('insights.scoresDesc')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm font-medium">{t('insights.focusScore')}</span>
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
                                <span className="text-sm font-medium">{t('insights.efficiencyScore')}</span>
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
                                <span className="text-sm font-medium">{t('insights.workLifeBalance')}</span>
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

            <Card>
                <CardHeader>
                    <CardTitle>📅 {t('insights.workPatterns')}</CardTitle>
                    <CardDescription>
                        {t('insights.workPatternsDesc')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <div className="text-sm text-muted-foreground">{t('insights.mostProductiveDay')}</div>
                            <div className="text-lg font-semibold">{translateDay(insights.patterns.mostProductiveDay)}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-sm text-muted-foreground">{t('insights.averageSession')}</div>
                            <div className="text-lg font-semibold">{insights.patterns.averageSessionLength} {t('insights.min')}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <Coffee className="h-3 w-3" />
                                {t('insights.breaksPerDay')}
                            </div>
                            <div className="text-lg font-semibold">{insights.patterns.breaksPerDay.toFixed(1)}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-sm text-muted-foreground">{t('insights.longestSession')}</div>
                            <div className="text-lg font-semibold">{Math.round(insights.patterns.longestSession / 60)} {t('insights.hours')}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-sm text-muted-foreground">{t('insights.leastProductiveDay')}</div>
                            <div className="text-lg font-semibold">{translateDay(insights.patterns.leastProductiveDay)}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
