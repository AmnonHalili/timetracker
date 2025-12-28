"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { User } from "@prisma/client"
import { Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

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

    const [activeTab, setActiveTab] = useState<"existing" | "new">("existing")

    // New User State
    const [newEmail, setNewEmail] = useState("")
    const [newRole] = useState("EMPLOYEE")
    const [newJobTitle, setNewJobTitle] = useState("")

    const handleExistingSubmit = async (e: React.FormEvent) => {
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
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Failed to add team member")
        } finally {
            setIsLoading(false)
        }
    }

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newEmail) return

        setIsLoading(true)
        try {
            // Use the new invitation API
            const res = await fetch("/api/team/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: newEmail,
                    role: newRole,
                    jobTitle: newJobTitle,
                    managerId: parentId // Assign directly to this parent
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.message)

            toast.success(`Invitation sent to ${newEmail}`)
            onSuccess()
            onOpenChange(false)
            // Reset form
            setNewEmail("")
            setNewJobTitle("")
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Failed to send invitation")
        } finally {
            setIsLoading(false)
        }
    }

    // Filter out users who are already managers of the current parent (circular)
    const validUsers = availableUsers.filter(u => u.id !== parentId && u.managerId !== parentId)

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add to {parentName}&apos;s Team</DialogTitle>
                </DialogHeader>

                <div className="flex gap-2 p-1 bg-muted rounded-lg mb-4">
                    <button
                        type="button"
                        onClick={() => setActiveTab("existing")}
                        className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all ${activeTab === "existing" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"
                            }`}
                    >
                        Select Existing
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("new")}
                        className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all ${activeTab === "new" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"
                            }`}
                    >
                        Invite New
                    </button>
                </div>

                {activeTab === "existing" ? (
                    <form onSubmit={handleExistingSubmit} className="space-y-4">
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
                ) : (
                    <form onSubmit={handleCreateSubmit} className="space-y-3">
                        <div className="space-y-1">
                            <Label htmlFor="newEmail">Email *</Label>
                            <Input
                                id="newEmail"
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="john@example.com"
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                An invitation will be sent to this email
                            </p>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="newJobTitle">Job Title</Label>
                            <Input
                                id="newJobTitle"
                                value={newJobTitle}
                                onChange={(e) => setNewJobTitle(e.target.value)}
                                placeholder="e.g. Junior Developer"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Send Invitation
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog >
    )
}
