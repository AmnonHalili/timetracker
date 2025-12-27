"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Lock } from "lucide-react"

interface Manager {
    id: string
    name: string
    email: string
    image: string | null
    jobTitle: string | null
}

interface SecondaryManager {
    manager: Manager
    permissions: string[]
}

interface ReportingStructureProps {
    primaryManager?: Manager | null
    secondaryManagers: SecondaryManager[]
}

const PERMISSION_LABELS: Record<string, { label: string; color: string }> = {
    'VIEW_TIME': { label: 'Viewer', color: 'bg-blue-500' },
    'EDIT_SETTINGS': { label: 'Editor', color: 'bg-purple-500' },
    'MANAGE_TASKS': { label: 'Task Manager', color: 'bg-orange-500' }
}

function ManagerCard({ manager, permissions, isPrimary }: {
    manager: Manager
    permissions?: string[]
    isPrimary?: boolean
}) {
    return (
        <div className="flex items-start gap-4 p-4 border rounded-lg bg-muted/30">
            <Avatar className="h-12 w-12">
                <AvatarImage src={manager.image || undefined} alt={manager.name} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {manager.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-1.5">
                <div>
                    <h4 className="font-semibold flex items-center gap-2">
                        {manager.name}
                        {isPrimary && (
                            <Badge variant="outline" className="text-xs">Primary</Badge>
                        )}
                    </h4>
                    <p className="text-sm text-muted-foreground">{manager.email}</p>
                    {manager.jobTitle && (
                        <p className="text-xs text-muted-foreground capitalize mt-0.5">
                            {manager.jobTitle}
                        </p>
                    )}
                </div>

                {permissions && permissions.length > 0 && (
                    <div>
                        <p className="text-xs text-muted-foreground mb-1.5">Permissions:</p>
                        <div className="flex flex-wrap gap-1">
                            {permissions.map(permission => {
                                const config = PERMISSION_LABELS[permission]
                                return config ? (
                                    <Badge
                                        key={permission}
                                        className={`text-xs text-white ${config.color}`}
                                    >
                                        {config.label}
                                    </Badge>
                                ) : (
                                    <Badge key={permission} variant="secondary" className="text-xs">
                                        {permission}
                                    </Badge>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export function ReportingStructure({ primaryManager, secondaryManagers }: ReportingStructureProps) {
    const hasAnyManager = primaryManager || secondaryManagers.length > 0

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            Reporting Structure
                            <Lock className="h-4 w-4 text-muted-foreground" />
                        </CardTitle>
                        <CardDescription>
                            Your managers and their permissions (read-only)
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {!hasAnyManager ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        No managers assigned yet.
                    </div>
                ) : (
                    <>
                        {/* Primary Manager Section */}
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold">Primary Manager</Label>
                            {primaryManager ? (
                                <ManagerCard manager={primaryManager} isPrimary />
                            ) : (
                                <p className="text-sm text-muted-foreground px-4 py-3 border rounded-lg bg-muted/20">
                                    No primary manager assigned
                                </p>
                            )}
                        </div>

                        {/* Secondary Managers Section */}
                        {secondaryManagers.length > 0 && (
                            <div className="space-y-3">
                                <Label className="text-sm font-semibold">
                                    Secondary Managers ({secondaryManagers.length})
                                </Label>
                                <div className="space-y-2">
                                    {secondaryManagers.map(sm => (
                                        <ManagerCard
                                            key={sm.manager.id}
                                            manager={sm.manager}
                                            permissions={sm.permissions}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    )
}
