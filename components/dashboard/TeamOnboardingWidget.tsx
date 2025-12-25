"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export function TeamOnboardingWidget() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [mode, setMode] = useState<'none' | 'join' | 'create'>('none')
    const [projectName, setProjectName] = useState("")

    const handleJoinTeam = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!projectName.trim()) return

        setIsLoading(true)
        try {
            const res = await fetch("/api/team/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectName })
            })

            const data = await res.json()

            if (!res.ok) {
                toast.error(data.message || "Failed to join team")
                return
            }

            toast.success("Request sent to team admins")
            setProjectName("")
            setMode('none')
        } catch {
            toast.error("An error occurred")
        } finally {
            setIsLoading(false)
        }
    }

    const handleCreateTeam = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!projectName.trim()) return

        setIsLoading(true)
        try {
            const res = await fetch("/api/team/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectName })
            })

            const data = await res.json()

            if (!res.ok) {
                toast.error(data.message || "Failed to create team")
                return
            }

            toast.success("Team created successfully!")
            router.refresh()
            setMode('none')
        } catch {
            toast.error("An error occurred")
        } finally {
            setIsLoading(false)
        }
    }

    if (mode === 'none') {
        return (
            <div className="flex gap-4 w-full justify-center">
                <Button
                    variant="outline"
                    className="w-40 shadow-sm"
                    onClick={() => setMode('join')}
                >
                    Join a Team
                </Button>
                <Button
                    className="w-40 shadow-sm"
                    onClick={() => setMode('create')}
                >
                    Create a Team
                </Button>
            </div>
        )
    }

    return (
        <Card className="w-full bg-muted/30 border-2 border-primary/10">
            <CardContent className="p-6 flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => { setMode('none'); setProjectName("") }}>
                    <ArrowRight className="h-4 w-4 rotate-180" />
                </Button>

                <div className="flex-1">
                    {mode === 'join' ? (
                        <form onSubmit={handleJoinTeam} className="flex gap-4 items-center">
                            <Label className="whitespace-nowrap font-medium text-lg">Join Team:</Label>
                            <Input
                                autoFocus
                                placeholder="Search for team name..."
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                className="h-10 text-lg"
                            />
                            <Button type="submit" disabled={isLoading} size="lg">
                                {isLoading ? <Loader2 className="animate-spin" /> : "Send Request"}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleCreateTeam} className="flex gap-4 items-center">
                            <Label className="whitespace-nowrap font-medium text-lg">Create Team:</Label>
                            <Input
                                autoFocus
                                placeholder="Enter new team name..."
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                className="h-10 text-lg"
                            />
                            <Button type="submit" disabled={isLoading} size="lg">
                                {isLoading ? <Loader2 className="animate-spin" /> : "Create & Start"}
                            </Button>
                        </form>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
