"use client"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { format } from "date-fns"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2 } from "lucide-react"

interface User {
    id: string
    name: string
    email: string
    role: string
    status: string
    dailyTarget: number
    workDays: number[]
    createdAt: Date
    jobTitle: string | null
}

interface TeamListProps {
    users: User[]
}

export function TeamList({ users }: TeamListProps) {
    const router = useRouter()
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [editTarget, setEditTarget] = useState<string>("")
    const [editDays, setEditDays] = useState<number[]>([])
    const [saving, setSaving] = useState(false)

    // Role change dialog state
    const [roleDialogUser, setRoleDialogUser] = useState<User | null>(null)
    const [selectedRole, setSelectedRole] = useState<string>("")
    const [savingRole, setSavingRole] = useState(false)

    // Delete dialog state
    const [deleteDialogUser, setDeleteDialogUser] = useState<User | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [showTransferAdmin, setShowTransferAdmin] = useState(false)
    const [newAdminId, setNewAdminId] = useState<string>("")

    const daysOfWeek = [
        { value: 0, label: 'Sunday' },
        { value: 1, label: 'Monday' },
        { value: 2, label: 'Tuesday' },
        { value: 3, label: 'Wednesday' },
        { value: 4, label: 'Thursday' },
        { value: 5, label: 'Friday' },
        { value: 6, label: 'Saturday' },
    ]

    const openDialog = (user: User) => {
        setSelectedUser(user)
        setEditTarget(user.dailyTarget.toString())
        setEditDays(user.workDays || [])
    }

    const closeDialog = () => {
        setSelectedUser(null)
        setEditTarget("")
        setEditDays([])
    }

    const openRoleDialog = (user: User, e: React.MouseEvent) => {
        e.stopPropagation()
        setRoleDialogUser(user)
        setSelectedRole(user.role)
    }

    const closeRoleDialog = () => {
        setRoleDialogUser(null)
        setSelectedRole("")
    }

    const openDeleteDialog = (user: User) => {
        setDeleteDialogUser(user)
        setShowTransferAdmin(false)
        setNewAdminId("")
    }

    const closeDeleteDialog = () => {
        setDeleteDialogUser(null)
        setShowTransferAdmin(false)
        setNewAdminId("")
    }

    const deleteUser = async () => {
        if (!deleteDialogUser) return

        setDeleting(true)
        try {
            const res = await fetch("/api/team/delete", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: deleteDialogUser.id,
                    newAdminId: showTransferAdmin ? newAdminId : undefined
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                // Check if we need to transfer admin
                if (data.requiresAdminTransfer) {
                    setShowTransferAdmin(true)
                    setDeleting(false)
                    return
                }
                throw new Error(data.message || "Failed to delete")
            }
            router.refresh()
            closeDeleteDialog()
        } catch (error) {
            alert(error instanceof Error ? error.message : "Error deleting user")
        } finally {
            setDeleting(false)
        }
    }

    const saveRole = async () => {
        if (!roleDialogUser) return

        setSavingRole(true)
        try {
            const res = await fetch("/api/team/role", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: roleDialogUser.id,
                    role: selectedRole
                }),
            })
            if (!res.ok) throw new Error("Failed to update")
            router.refresh()
            closeRoleDialog()
        } catch {
            alert("Error updating role")
        } finally {
            setSavingRole(false)
        }
    }

    const saveEdit = async () => {
        if (!selectedUser) return

        setSaving(true)
        try {
            const res = await fetch("/api/team/work-settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: selectedUser.id,
                    dailyTarget: parseFloat(editTarget),
                    workDays: editDays
                }),
            })
            if (!res.ok) throw new Error("Failed to update")
            router.refresh()
            closeDialog()
        } catch {
            alert("Error updating work settings")
        } finally {
            setSaving(false)
        }
    }

    const toggleDay = (day: number) => {
        setEditDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b)
        )
    }

    const getRoleBadgeVariant = (role: string) => {
        if (role === "ADMIN") return "default"
        if (role === "MANAGER") return "secondary"
        return "outline"
    }

    if (users.length === 0) {
        return <div className="text-center text-muted-foreground py-8">No team members yet.</div>
    }

    return (
        <>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Job Title</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDialog(user)}>
                                <TableCell className="font-bold">{user.name}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell>
                                    <span className="capitalize">
                                        {user.jobTitle || user.role.toLowerCase().replace('_', ' ')}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => openDeleteDialog(user)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Work Settings Dialog */}
            <Dialog open={!!selectedUser} onOpenChange={(open) => !open && closeDialog()}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Work Settings - {selectedUser?.name}</DialogTitle>
                        <DialogDescription>
                            Configure work days and daily target hours for this team member.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 pt-4">
                        <div className="space-y-3">
                            <Label>Work Days</Label>
                            <p className="text-xs text-muted-foreground">
                                Select the days this team member typically works.
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {daysOfWeek.map(day => (
                                    <button
                                        key={day.value}
                                        type="button"
                                        onClick={() => toggleDay(day.value)}
                                        className={`px-4 py-3 rounded-md text-sm font-medium transition-colors ${editDays.includes(day.value)
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                                            }`}
                                    >
                                        {day.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="target">Daily Target (Hours)</Label>
                            <Input
                                id="target"
                                type="number"
                                step="0.5"
                                value={editTarget}
                                onChange={e => setEditTarget(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                This is used to calculate daily progress in reports.
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeDialog} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={saveEdit} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Role Change Dialog */}
            <Dialog open={!!roleDialogUser} onOpenChange={(open) => !open && closeRoleDialog()}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Change Role - {roleDialogUser?.name}</DialogTitle>
                        <DialogDescription>
                            Select a new role for this team member.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Select value={selectedRole} onValueChange={setSelectedRole}>
                                <SelectTrigger id="role">
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ADMIN">Admin</SelectItem>
                                    <SelectItem value="MANAGER">Manager</SelectItem>
                                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                <strong>Admin:</strong> Full access to all features<br />
                                <strong>Manager:</strong> Can manage team members<br />
                                <strong>Employee:</strong> Basic access
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeRoleDialog} disabled={savingRole}>
                            Cancel
                        </Button>
                        <Button onClick={saveRole} disabled={savingRole}>
                            {savingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Role
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteDialogUser} onOpenChange={(open) => !open && closeDeleteDialog()}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Delete User</DialogTitle>
                        <DialogDescription>
                            {showTransferAdmin ? (
                                <>Select a new admin before deleting <strong>{deleteDialogUser?.name}</strong></>
                            ) : (
                                <>Are you sure you want to delete <strong>{deleteDialogUser?.name}</strong>? This action cannot be undone.</>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {showTransferAdmin ? (
                        <div className="space-y-4 pt-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                                <p className="text-sm text-amber-800">
                                    ⚠️ You are the only admin. Please select a new admin before proceeding.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="newAdmin">Transfer Admin To</Label>
                                <Select value={newAdminId} onValueChange={setNewAdminId}>
                                    <SelectTrigger id="newAdmin">
                                        <SelectValue placeholder="Select user" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users
                                            .filter(u => u.id !== deleteDialogUser?.id)
                                            .map(u => (
                                                <SelectItem key={u.id} value={u.id}>
                                                    {u.name} ({u.email})
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4 mt-4">
                            <p className="text-sm text-destructive">
                                ⚠️ All time entries and data associated with this user will be permanently deleted.
                            </p>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={closeDeleteDialog} disabled={deleting}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={deleteUser}
                            disabled={deleting || (showTransferAdmin && !newAdminId)}
                        >
                            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {showTransferAdmin ? "Transfer & Delete" : "Delete User"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
