"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { X, Plus, Loader2 } from "lucide-react"

interface Manager {
    id: string
    name: string
    email: string
}

interface SecondaryManagerData {
    managerId: string
    permissions: string[]
}

interface SecondaryManagersFormProps {
    employeeId: string
    currentSecondaryManagers: Array<{
        managerId: string
        manager: {
            id: string
            name: string
            email: string
        }
        permissions: string[]
    }>
    availableManagers: Manager[]
    onSave: (managers: SecondaryManagerData[]) => Promise<void>
}

const PERMISSIONS = [
    { id: 'VIEW_TIME', label: 'View Time Entries', description: 'Can view time tracking data' },
    { id: 'EDIT_SETTINGS', label: 'Edit Work Settings', description: 'Can modify work days and targets' },
    { id: 'APPROVE_TIME', label: 'Approve Time Entries', description: 'Can approve submitted time' },
    { id: 'MANAGE_TASKS', label: 'Manage Tasks', description: 'Can assign and manage tasks' }
]

export function SecondaryManagersForm({
    employeeId,
    currentSecondaryManagers,
    availableManagers,
    onSave
}: SecondaryManagersFormProps) {
    const [selectedManagers, setSelectedManagers] = useState<SecondaryManagerData[]>(
        currentSecondaryManagers.map(sm => ({
            managerId: sm.managerId,
            permissions: sm.permissions
        }))
    )
    const [saving, setSaving] = useState(false)

    const handleAddManager = (managerId: string) => {
        if (!managerId || selectedManagers.some(m => m.managerId === managerId)) return

        setSelectedManagers([...selectedManagers, { managerId, permissions: [] }])
    }

    const handleRemoveManager = (managerId: string) => {
        setSelectedManagers(selectedManagers.filter(m => m.managerId !== managerId))
    }

    const handleTogglePermission = (managerId: string, permission: string) => {
        setSelectedManagers(selectedManagers.map(m => {
            if (m.managerId === managerId) {
                const hasPermission = m.permissions.includes(permission)
                return {
                    ...m,
                    permissions: hasPermission
                        ? m.permissions.filter(p => p !== permission)
                        : [...m.permissions, permission]
                }
            }
            return m
        }))
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            await onSave(selectedManagers)
        } finally {
            setSaving(false)
        }
    }

    const getManagerName = (managerId: string) => {
        const current = currentSecondaryManagers.find(m => m.managerId === managerId)
        if (current) return current.manager.name

        const available = availableManagers.find(m => m.id === managerId)
        return available?.name || 'Unknown'
    }

    const availableToAdd = availableManagers.filter(
        m => !selectedManagers.some(sm => sm.managerId === m.id) && m.id !== employeeId
    )

    return (
        <div className="space-y-6">
            {/* Add Manager Section */}
            <div className="space-y-3">
                <Label>Add Secondary Manager</Label>
                <div className="flex gap-2">
                    <Select onValueChange={handleAddManager}>
                        <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select a manager..." />
                        </SelectTrigger>
                        <SelectContent>
                            {availableToAdd.length === 0 ? (
                                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                    No available managers
                                </div>
                            ) : (
                                availableToAdd.map(manager => (
                                    <SelectItem key={manager.id} value={manager.id}>
                                        {manager.name} ({manager.email})
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Selected Managers List */}
            {selectedManagers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                    No secondary managers assigned. Add one above to get started.
                </div>
            ) : (
                <div className="space-y-4">
                    {selectedManagers.map(manager => (
                        <div key={manager.managerId} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold">{getManagerName(manager.managerId)}</h4>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => handleRemoveManager(manager.managerId)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm text-muted-foreground">Permissions</Label>
                                <div className="grid gap-3">
                                    {PERMISSIONS.map(permission => (
                                        <div key={permission.id} className="flex items-start space-x-3">
                                            <Checkbox
                                                id={`${manager.managerId}-${permission.id}`}
                                                checked={manager.permissions.includes(permission.id)}
                                                onCheckedChange={() =>
                                                    handleTogglePermission(manager.managerId, permission.id)
                                                }
                                            />
                                            <div className="grid gap-1 leading-none">
                                                <label
                                                    htmlFor={`${manager.managerId}-${permission.id}`}
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                >
                                                    {permission.label}
                                                </label>
                                                <p className="text-xs text-muted-foreground">
                                                    {permission.description}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Secondary Managers
                </Button>
            </div>
        </div>
    )
}
