"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import { Loader2, Check } from "lucide-react"
import { User } from "@prisma/client"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

interface AssignManagerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    employee: User | null
    managers: User[]
    onManagerChange?: (managerId: string | null, chiefType: 'partner' | 'independent' | null) => void
}

export function AssignManagerDialog({ open, onOpenChange, employee, managers, onManagerChange }: AssignManagerDialogProps) {
    const { data: session } = useSession()
    const [selectedManagerId, setSelectedManagerId] = useState<string | null>(employee?.managerId || null)

    // Chief type selection state
    const [showChiefType, setShowChiefType] = useState(false)
    const [chiefType, setChiefType] = useState<'partner' | 'independent' | null>(null)

    // Check if current user is top-level admin (has no manager)
    const isTopLevelAdmin = session?.user?.role === "ADMIN" && !session?.user?.managerId
    const [saving, setSaving] = useState(false)

    // Update state when dialog opens or employee changes
    useEffect(() => {
        if (open && employee) {
            setSelectedManagerId(employee.managerId)
            // If existing top-level chief, maybe we should show independent? 
            // Logic: if changing to 'no manager', we need to select type.
            setChiefType(null)
            setShowChiefType(false)
        }
    }, [open, employee])

    // Show chief type selection logic
    useEffect(() => {
        if (!employee) return

        const isNoManager = selectedManagerId === "none" || selectedManagerId === null
        const shouldShow = isNoManager && isTopLevelAdmin && employee.role === "ADMIN"
        setShowChiefType(shouldShow)

        if (!shouldShow) {
            setChiefType(null)
        }
    }, [selectedManagerId, employee, isTopLevelAdmin])

    const handleSave = async () => {
        if (!employee) return

        // Validate chief type if required
        if (showChiefType && !chiefType) {
            alert("Please select how this chief should be added (Partner or Independent)")
            return
        }

        setSaving(true)
        try {
            const res = await fetch("/api/team/assign-manager", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeId: employee.id,
                    managerId: selectedManagerId === "none" ? null : selectedManagerId,
                    chiefType: showChiefType ? chiefType : undefined
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.message || "Failed to assign manager")
            }

            if (onManagerChange) {
                // If we still want to notify parent for some reason, but we primarily save here
                onManagerChange(null, null) // clearer
            }

            onOpenChange(false)
            // We need to trigger a refresh
            window.location.reload()
        } catch (error) {
            alert(error instanceof Error ? error.message : "Error assigning manager")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Assign Manager</DialogTitle>
                    <DialogDescription>
                        Select a manager for <strong>{employee?.name}</strong>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="manager">Manager</Label>
                        <Select
                            value={selectedManagerId || "none"}
                            onValueChange={(value) => {
                                const newManagerId = value === "none" ? null : value
                                setSelectedManagerId(newManagerId)
                            }}
                        >
                            <SelectTrigger id="manager">
                                <SelectValue placeholder="Select manager" />
                            </SelectTrigger>
                            <SelectContent>
                                {isTopLevelAdmin && (
                                    <SelectItem value="none">
                                        <div className="flex items-center gap-2">
                                            <span>No Manager (Direct to Admin)</span>
                                        </div>
                                    </SelectItem>
                                )}
                                {managers.map((manager) => (
                                    <SelectItem key={manager.id} value={manager.id}>
                                        <div className="flex items-center gap-2">
                                            <span>{manager.name}</span>
                                            <Badge variant="secondary" className="text-xs">
                                                {manager.role}
                                            </Badge>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {employee?.managerId && (
                        <div className="bg-muted p-3 rounded-md">
                            <p className="text-sm text-muted-foreground">
                                Current manager: <span className="font-medium text-foreground">
                                    {managers.find(m => m.id === employee.managerId)?.name || "Unknown"}
                                </span>
                            </p>
                        </div>
                    )}

                    {/* Chief Type Selection */}
                    {showChiefType && (
                        <div className="space-y-4 pt-2 border-t mt-4">
                            <div>
                                <Label className="text-base font-semibold">
                                    Chief Type <span className="text-destructive">*</span>
                                </Label>
                                <p className="text-sm text-muted-foreground mt-1 mb-4">
                                    Select how this chief should be added to the organization
                                </p>
                            </div>

                            <div className="grid gap-3">
                                {/* Option 1: Partner */}
                                <Card
                                    className={cn(
                                        "p-4 cursor-pointer border-2 transition-all hover:border-primary/50",
                                        chiefType === "partner"
                                            ? "border-primary bg-primary/5"
                                            : "border-border"
                                    )}
                                    onClick={() => setChiefType("partner")}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={cn(
                                            "mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                                            chiefType === "partner"
                                                ? "border-primary bg-primary"
                                                : "border-muted-foreground"
                                        )}>
                                            {chiefType === "partner" && (
                                                <Check className="h-3 w-3 text-primary-foreground" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-sm mb-1">
                                                Partner – Shared Leadership
                                            </h4>
                                            <p className="text-sm text-muted-foreground mb-2">
                                                This chief will act as a shared manager.
                                            </p>
                                        </div>
                                    </div>
                                </Card>

                                {/* Option 2: Independent */}
                                <Card
                                    className={cn(
                                        "p-4 cursor-pointer border-2 transition-all hover:border-primary/50",
                                        chiefType === "independent"
                                            ? "border-primary bg-primary/5"
                                            : "border-border"
                                    )}
                                    onClick={() => setChiefType("independent")}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={cn(
                                            "mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                                            chiefType === "independent"
                                                ? "border-primary bg-primary"
                                                : "border-muted-foreground"
                                        )}>
                                            {chiefType === "independent" && (
                                                <Check className="h-3 w-3 text-primary-foreground" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-sm mb-1">
                                                Independent Chief – Separate Branch
                                            </h4>
                                            <p className="text-sm text-muted-foreground mb-2">
                                                This chief will be a separate top-level manager.
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
