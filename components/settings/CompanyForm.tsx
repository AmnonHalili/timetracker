
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface CompanyFormProps {
    initialName: string
    initialWorkMode?: 'OUTPUT_BASED' | 'TIME_BASED' | 'PROJECT_BASED'
    projectId: string
}

export function CompanyForm({ initialName, initialWorkMode = 'TIME_BASED', projectId }: CompanyFormProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [name, setName] = useState(initialName)
    // Filter out PROJECT_BASED since it's deprecated, default to TIME_BASED
    const [workMode, setWorkMode] = useState<'OUTPUT_BASED' | 'TIME_BASED'>(
        initialWorkMode === 'PROJECT_BASED' ? 'TIME_BASED' : initialWorkMode
    )

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const res = await fetch(`/api/projects/${projectId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, workMode }),
            })

            if (!res.ok) throw new Error("Failed to update workspace settings")

            toast.success("Workspace settings updated")
            router.refresh()
        } catch (error) {
            console.error(error)
            toast.error("Failed to update workspace settings")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form onSubmit={onSubmit}>
            <Card>
                <CardHeader>
                    <CardTitle>Workspace Information</CardTitle>
                    <CardDescription>
                        Update your workspace&apos;s display name and settings. These will apply to all members.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="companyName">Workspace Name</Label>
                        <Input
                            id="companyName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="space-y-4">
                        <Label>Work Calculation Mode</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div
                                className={`p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-muted-foreground/50 ${workMode === 'TIME_BASED' ? 'border-primary bg-primary/5' : 'border-muted'}`}
                                onClick={() => !isLoading && setWorkMode('TIME_BASED')}
                            >
                                <div className="font-semibold mb-1">Time Based (Attendance)</div>
                                <div className="text-sm text-muted-foreground">
                                    Hours are calculated based on total time at work (Clock In to Clock Out).
                                    Breaks are considered part of the workday.
                                </div>
                            </div>

                            <div
                                className={`p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-muted-foreground/50 ${workMode === 'OUTPUT_BASED' ? 'border-primary bg-primary/5' : 'border-muted'}`}
                                onClick={() => !isLoading && setWorkMode('OUTPUT_BASED')}
                            >
                                <div className="font-semibold mb-1">Output Based (Effective)</div>
                                <div className="text-sm text-muted-foreground">
                                    Hours are calculated based on net working time.
                                    Breaks are deducted from the total.
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </CardFooter>
            </Card>
        </form>
    )
}
