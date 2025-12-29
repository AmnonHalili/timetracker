"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { WorkLocationSetup } from "@/components/work-location/WorkLocationSetup"

export function TeamOnboardingWidget() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [mode, setMode] = useState<'none' | 'join' | 'create' | 'location'>('none')
    const [projectName, setProjectName] = useState("") // For creating team
    const [joinCode, setJoinCode] = useState("") // For joining team
    const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)

    const handleJoinTeam = async (e: React.FormEvent) => {
        e.preventDefault()
        const code = joinCode.trim().toUpperCase()
        if (!code) return

        setIsLoading(true)
        try {
            const res = await fetch("/api/team/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ joinCode: code })
            })

            const data = await res.json()

            if (!res.ok) {
                toast.error(data.message || "Failed to join team")
                return
            }

            toast.success("Request sent to team admins")

            setJoinCode("")
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
            setCreatedProjectId(data.projectId)
            setMode('location') // Move to location setup step
        } catch {
            toast.error("An error occurred")
        } finally {
            setIsLoading(false)
        }
    }

    const handleLocationSave = async (location: {
        latitude: number
        longitude: number
        radius: number
        address?: string
    } | null) => {
        if (!createdProjectId) return

        setIsLoading(true)
        try {
            const response = await fetch(`/api/projects/${createdProjectId}/work-location`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(location),
            })

            if (!response.ok) {
                throw new Error("Failed to save work location")
            }

            toast.success(location ? "Work location saved!" : "Skipped work location setup")
            router.refresh()
            setMode('none')
            setCreatedProjectId(null)
        } catch (error) {
            console.error("Error saving work location:", error)
            toast.error("Failed to save work location, but team was created successfully")
            router.refresh()
            setMode('none')
            setCreatedProjectId(null)
        } finally {
            setIsLoading(false)
        }
    }

    const handleLocationSkip = () => {
        handleLocationSave(null)
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

    if (mode === 'location') {
        return (
            <Card className="w-full bg-muted/30 border-2 border-primary/10">
                <CardContent className="p-6">
                    <div className="mb-4 flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setMode('none')}>
                            <ArrowRight className="h-4 w-4 rotate-180" />
                        </Button>
                        <h3 className="text-lg font-semibold">Set Work Location (Optional)</h3>
                    </div>
                    <WorkLocationSetup
                        onSave={handleLocationSave}
                        onSkip={handleLocationSkip}
                        isOptional={true}
                    />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="w-full bg-muted/30 border-2 border-primary/10">
            <CardContent className="p-6 flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => { setMode('none'); setProjectName(""); setJoinCode("") }}>
                    <ArrowRight className="h-4 w-4 rotate-180" />
                </Button>

                <div className="flex-1">
                    {mode === 'join' ? (
                        <form onSubmit={handleJoinTeam} className="flex gap-4 items-center">
                            <Label className="whitespace-nowrap font-medium text-lg">Team Code:</Label>
                            <Input
                                autoFocus
                                placeholder="Enter team code..."
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value)}
                                className="h-10 text-lg uppercase"
                                maxLength={8}
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
