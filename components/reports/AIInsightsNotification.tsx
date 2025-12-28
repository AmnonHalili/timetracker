"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { useLanguage } from "@/lib/useLanguage"

interface PersonalInsights {
    hasData: boolean
}

export function AIInsightsNotification() {
    const { t, dir } = useLanguage()
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

    if (loading || insights?.hasData) {
        return null
    }

    return (
        <div className="flex border rounded-lg p-3 bg-muted/20 items-center justify-between text-sm" dir={dir}>
            <div className="flex items-center gap-2 text-muted-foreground">
                <span>💡</span>
                <span>{t('insights.startTracking')}</span>
            </div>
            <Button size="sm" variant="ghost" className="h-6 text-xs" asChild>
                <Link href="/insights">
                    {t('insights.learnMore')} <ArrowRight className={`h-3 w-3 ${dir === 'rtl' ? 'mr-1 rotate-180' : 'ml-1'}`} />
                </Link>
            </Button>
        </div>
    )
}

