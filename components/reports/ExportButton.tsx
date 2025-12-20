"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useState } from "react"

export function ExportButton() {
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(false)

    const handleExport = async () => {
        setLoading(true)
        const params = new URLSearchParams(searchParams)

        // Default to current month/year if missing (matching page logic)
        const today = new Date()
        if (!params.has("month")) params.set("month", today.getMonth().toString())
        if (!params.has("year")) params.set("year", today.getFullYear().toString())
        // userId is optional (if missing, API assumes current user, which is correct)

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
            {loading ? "Exporting..." : "Export CSV"}
        </Button>
    )
}
