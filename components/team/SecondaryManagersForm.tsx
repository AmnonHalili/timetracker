"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

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
import { X, Loader2 } from "lucide-react"
import { useLanguage } from "@/lib/useLanguage"

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

// Permissions will be translated in the component using useLanguage
const PERMISSION_KEYS = [
    { id: 'VIEW_TIME', labelKey: 'team.viewTimeEntries', descKey: 'team.viewTimeEntriesDesc' },
    { id: 'EDIT_SETTINGS', labelKey: 'team.editWorkSettings', descKey: 'team.editWorkSettingsDesc' },
    { id: 'MANAGE_TASKS', labelKey: 'team.manageTasks', descKey: 'team.manageTasksDesc' }
]

export function SecondaryManagersForm({
    employeeId,
    currentSecondaryManagers,
    availableManagers,
    onSave
}: SecondaryManagersFormProps) {
    const { t, isRTL } = useLanguage()
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
                <Label className={isRTL ? 'text-right' : 'text-left'}>{t('team.addSecondaryManager')}</Label>
                <div className="flex gap-2">
                    <Select onValueChange={handleAddManager}>
                        <SelectTrigger className="flex-1">
                            <SelectValue placeholder={t('team.selectManager')} />
                        </SelectTrigger>
                        <SelectContent>
                            {availableToAdd.length === 0 ? (
                                <div className={`px-2 py-6 text-center text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                                    {t('team.noAvailableManagers')}
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
                <div className={`py-8 text-muted-foreground text-sm ${isRTL ? 'text-right' : 'text-center'}`}>
                    {t('team.noSecondaryManagers')}
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
                                <Label className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>{t('team.permissions')}</Label>
                                <div className="grid gap-3">
                                    {PERMISSION_KEYS.map(permission => (
                                        <div key={permission.id} className={`flex items-start ${isRTL ? 'flex-row-reverse space-x-reverse' : 'space-x-3'}`}>
                                            <Checkbox
                                                id={`${manager.managerId}-${permission.id}`}
                                                checked={manager.permissions.includes(permission.id)}
                                                onCheckedChange={() =>
                                                    handleTogglePermission(manager.managerId, permission.id)
                                                }
                                            />
                                            <div className={`grid gap-1 leading-none ${isRTL ? 'text-right' : 'text-left'}`}>
                                                <label
                                                    htmlFor={`${manager.managerId}-${permission.id}`}
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                >
                                                    {t(permission.labelKey as any)}
                                                </label>
                                                <p className="text-xs text-muted-foreground">
                                                    {t(permission.descKey as any)}
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

            <div className={`flex ${isRTL ? 'justify-start' : 'justify-end'} pt-4 border-t`}>
                <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />}
                    {t('team.saveSecondaryManagers')}
                </Button>
            </div>
        </div>
    )
}
