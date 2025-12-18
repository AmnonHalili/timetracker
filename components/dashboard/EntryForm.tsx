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
        <div className="flex items-center gap-2 p-4 bg-muted/30 rounded-md">
            <Input
                className="flex-1 min-w-[150px] bg-background border-input"
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
            />
            <span className="text-muted-foreground">-</span>

            <div className="flex items-center gap-2">
                <Input
                    type="time" // Browser native time picker logic helps, or just text with masking
                    className="w-24 bg-background border-input"
                    placeholder="09:00"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                />
                <span className="text-muted-foreground">-</span>
                <Input
                    type="time"
                    className="w-24 bg-background border-input"
                    placeholder="17:00"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                />
            </div>

            <div className="ml-auto flex items-center gap-4">
                <span className="text-sm text-muted-foreground">{date}</span>
                <Button
                    variant="ghost"
                    className="font-normal hover:bg-transparent"
                    onClick={handleAdd}
                    disabled={loading}
                >
                    Add
                </Button>
            </div>
        </div>
    )
}
