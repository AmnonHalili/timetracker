
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLanguage } from "@/lib/useLanguage"

interface CompanyFormProps {
    initialName: string
    initialWorkMode?: 'OUTPUT_BASED' | 'TIME_BASED' | 'PROJECT_BASED'
    projectId: string
    joinCode: string
}

export function CompanyForm({ initialName, initialWorkMode = 'TIME_BASED', projectId, joinCode }: CompanyFormProps) {
    const router = useRouter()
    const { t } = useLanguage()
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
                    <CardTitle>{t('workspace.workspaceInformation')}</CardTitle>
                    <CardDescription>
                        {t('workspace.updateWorkspaceSettings')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="companyName">{t('workspace.workspaceName')}</Label>
                        <Input
                            id="companyName"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>{t('workspace.teamCode')}</Label>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 p-3 bg-muted rounded-md text-center text-lg font-mono tracking-wider select-all border">
                                {joinCode}
                            </code>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    navigator.clipboard.writeText(joinCode)
                                    toast.success(t('workspace.copy'))
                                }}
                            >
                                {t('workspace.copy')}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t('workspace.teamCodeDescription')}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <Label>{t('workspace.workCalculationMode')}</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div
                                className={`p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-muted-foreground/50 ${workMode === 'TIME_BASED' ? 'border-primary bg-primary/5' : 'border-muted'}`}
                                onClick={() => !isLoading && setWorkMode('TIME_BASED')}
                            >
                                <div className="font-semibold mb-1">{t('workspace.timeBased')}</div>
                                <div className="text-sm text-muted-foreground">
                                    {t('workspace.timeBasedDescription')}
                                </div>
                            </div>

                            <div
                                className={`p-4 rounded-lg border-2 transition-all cursor-pointer hover:border-muted-foreground/50 ${workMode === 'OUTPUT_BASED' ? 'border-primary bg-primary/5' : 'border-muted'}`}
                                onClick={() => !isLoading && setWorkMode('OUTPUT_BASED')}
                            >
                                <div className="font-semibold mb-1">{t('workspace.outputBased')}</div>
                                <div className="text-sm text-muted-foreground">
                                    {t('workspace.outputBasedDescription')}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('workspace.saveChanges')}
                    </Button>
                </CardFooter>
            </Card>
        </form>
    )
}
