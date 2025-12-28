"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { useLanguage } from "@/lib/useLanguage"

interface ExportButtonProps {
    userId: string
    year: number
    month: number
}

export function ExportButton({ userId, year, month }: ExportButtonProps) {
    const searchParams = useSearchParams()
    const { t } = useLanguage()
    const [loading, setLoading] = useState(false)

    const handleExport = async () => {
        setLoading(true)
        const params = new URLSearchParams(searchParams)

        // Use props if provided, otherwise fallback to params or current date
        if (!params.has("month")) params.set("month", month.toString())
        if (!params.has("year")) params.set("year", year.toString())
        if (!params.has("userId")) params.set("userId", userId)

        try {
            const res = await fetch(`/api/reports/export?${params.toString()}`)
            if (!res.ok) throw new Error("Export failed")

            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url

            // Try to get filename from header
            const contentDisposition = res.headers.get("Content-Disposition")
            let filename = "report.csv"
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="(.+)"/)
                if (match) filename = match[1]
            }

            a.download = filename
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (error) {
            console.error("Export error:", error)
            alert("Failed to export report")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
            <Download className="mr-2 h-4 w-4" />
            {loading ? t('common.loading') : t('reports.exportCSV')}
        </Button>
    )
}
