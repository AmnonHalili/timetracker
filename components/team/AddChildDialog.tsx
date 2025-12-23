"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { User } from "@prisma/client"
import { UserPlus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface AddChildDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    parentId: string | null
    parentName: string
    availableUsers: User[] // Passed from parent to avoid prop drilling complex state
    onSuccess: () => void
}

export function AddChildDialog({
    isOpen,
    onOpenChange,
    parentId,
    parentName,
    availableUsers,
    onSuccess
}: AddChildDialogProps) {
    const [selectedUserId, setSelectedUserId] = useState<string>("")
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedUserId) return

        setIsLoading(true)
        try {
            const res = await fetch("/api/team/assign-parent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: selectedUserId,
                    parentId: parentId
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.message)

            toast.success("Team member added successfully")
            onSuccess()
            onOpenChange(false)
            setSelectedUserId("")
        } catch (error: any) {
            toast.error(error.message || "Failed to add team member")
        } finally {
            setIsLoading(false)
        }
    }

    // Filter out users who are already managers of the current parent (circular)
    // For now, we rely on server check, but client side filtering helps UX
    // A simple check is: don't show the parent themselves
    const validUsers = availableUsers.filter(u => u.id !== parentId && u.managerId !== parentId)

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add to {parentName}'s Team</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label>Select Team Member</Label>
                        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a user..." />
                            </SelectTrigger>
                            <SelectContent>
                                {validUsers.length === 0 ? (
                                    <div className="p-2 text-sm text-muted-foreground text-center">
                                        No unassigned users available
                                    </div>
                                ) : (
                                    validUsers.map((user) => (
                                        <SelectItem key={user.id} value={user.id}>
                                            <div className="flex items-center gap-2">
                                                <span>{user.name}</span>
                                                <span className="text-xs text-muted-foreground">({user.role})</span>
                                            </div>
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            Users who already report to {parentName} are hidden.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!selectedUserId || isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Add to Team
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
