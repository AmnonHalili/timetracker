"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { useRouter } from "next/navigation"

export function EntryForm() {
    const router = useRouter()

    // Default current time to next 15-min block or similar? 
    // Or just empty strings
    const [description, setDescription] = useState("")
    const [startTime, setStartTime] = useState("")
    const [endTime, setEndTime] = useState("")
    const [loading, setLoading] = useState(false)

    const date = new Date().toLocaleDateString('en-GB')

    const handleAdd = async () => {
        if (!startTime || !endTime) return
        setLoading(true)
        try {
            const start = new Date()
            const end = new Date()

            const [startH, startM] = startTime.split(':')
            const [endH, endM] = endTime.split(':')

            if (!startH || !startM || !endH || !endM) return // Basic format check

            start.setHours(parseInt(startH), parseInt(startM), 0, 0)
            end.setHours(parseInt(endH), parseInt(endM), 0, 0)

            // Handle overnight case if needed (end < start) -> usually implies next day
            // For simple "Today" log, we might assume user means same day. 
            // If they type 23:00 - 01:00, user might expect 2 hours.
            if (end < start) {
                // Not standard logic yet, but let's leave as is for "Today"
            }

            await fetch('/api/time-entries', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'manual',
                    manualData: {
                        start,
                        end,
                        description
                    }
                }),
            })

            setDescription("")
            setStartTime("")
            setEndTime("")
            router.refresh()
        } catch (error) {
            console.error(error)
            alert("Failed to create entry")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-muted/30 rounded-xl border border-transparent hover:border-border/50 transition-colors">
            <div className="relative flex-1 w-full sm:w-auto">
                <Input
                    className="pl-9 bg-background border-input shadow-sm"
                    placeholder="What did you work on?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                <div className="relative w-[110px]">
                    <Input
                        type="time"
                        className="pl-9 bg-background border-input shadow-sm"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    </div>
                </div>
                <span className="text-muted-foreground/50">→</span>
                <div className="relative w-[110px]">
                    <Input
                        type="time"
                        className="pl-9 bg-background border-input shadow-sm"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
                <span className="hidden sm:inline text-xs text-muted-foreground font-medium">{date}</span>
                <Button
                    onClick={handleAdd}
                    disabled={loading}
                    className="w-full sm:w-auto bg-primary hover:bg-primary/90 shadow-sm"
                >
                    <span className="mr-2 text-lg leading-none">+</span>
                    Add Entry
                </Button>
            </div>
        </div>
    )
}
