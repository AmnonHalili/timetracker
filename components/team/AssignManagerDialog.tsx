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
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { User } from "@prisma/client"

interface AssignManagerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    employee: User | null
    managers: User[]
}

export function AssignManagerDialog({ open, onOpenChange, employee, managers }: AssignManagerDialogProps) {
    const router = useRouter()
    const [selectedManagerId, setSelectedManagerId] = useState<string | null>(employee?.managerId || null)
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        if (!employee) return

        setSaving(true)
        try {
            const res = await fetch("/api/team/assign-manager", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeId: employee.id,
                    managerId: selectedManagerId
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.message || "Failed to assign manager")
            }

            router.refresh()
            onOpenChange(false)
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
                            onValueChange={(value) => setSelectedManagerId(value === "none" ? null : value)}
                        >
                            <SelectTrigger id="manager">
                                <SelectValue placeholder="Select manager" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">
                                    <div className="flex items-center gap-2">
                                        <span>No Manager (Direct to Admin)</span>
                                    </div>
                                </SelectItem>
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
