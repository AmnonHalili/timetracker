"use client"

import { useProject } from "@/components/providers/ProjectProvider"
import { createPortal } from "react-dom"
import { useEffect, useState } from "react"

export function ProjectLoadingOverlay() {
    const { isSwitching } = useProject()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted || !isSwitching) return null

    // Portal to body or a specific container if we want to cover everything
    // Or we can just render it inline if the parent is relative.
    // For global main content coverage, inline in layout usually works best if we want to keep sidebar interactive.
    // But let's try inline first, assuming it's placed in a relative container.

    return (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-start justify-center pt-20 h-full animate-in fade-in duration-200">
            <div className="flex items-center gap-3 bg-card border shadow-lg px-6 py-3 rounded-full animate-in zoom-in-95 duration-200">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium text-muted-foreground">Syncing workspace...</p>
            </div>
        </div>
    )
}
