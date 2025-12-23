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
import { format } from "date-fns"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

interface User {
    id: string
    name: string
    email: string
    role: string
    status: string
    dailyTarget: number
    workDays: number[]
    createdAt: Date
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
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Joined</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDialog(user)}>
                                <TableCell className="font-bold">{user.name}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                    <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                                        {user.role}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={
                                        user.status === "ACTIVE" ? "text-green-600 border-green-600" :
                                            user.status === "PENDING" ? "text-yellow-600 border-yellow-600" : ""
                                    }>
                                        {user.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    {format(new Date(user.createdAt), 'MMM d, yyyy')}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

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
        </>
    )
}
