"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

interface CreateTaskDialogProps {
    users: { id: string; name: string | null; email: string }[]
    onTaskCreated?: () => void
}

export function CreateTaskDialog({ users: initialUsers, onTaskCreated }: CreateTaskDialogProps) {
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false) // Standardized to isOpen
    const [title, setTitle] = useState("")
    const [assignedToIds, setAssignedToIds] = useState<string[]>([])
    const [priority, setPriority] = useState("MEDIUM")
    const [deadline, setDeadline] = useState("")
    const [deadlineTime, setDeadlineTime] = useState("")
    const [description, setDescription] = useState("")
    const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string }>>([])
    const [loading, setLoading] = useState(false)


    useEffect(() => {
        if (isOpen) {
            // Fetch users for assignment
            // If initialUsers is empty or we want fresh list
            fetch("/api/team?all=true")
                .then(res => res.json())
                .then(data => setUsers(data))
                .catch(() => {
                    console.error("Failed to load users")
                    setUsers(initialUsers) // Fallback
                })
        }
    }, [isOpen, initialUsers])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            let finalDeadline = deadline;
            if (deadline && deadlineTime) {
                finalDeadline = `${deadline}T${deadlineTime}:00`
            } else if (deadline) {
                // If only date is selected, maybe default to end of day? Or just date object (00:00 local).
                // Let's keep it simple as just the date string for now, backend parses generic date.
            }

            await fetch("/api/tasks", {
                method: "POST",
                body: JSON.stringify({
                    title,
                    assignedToIds,
                    priority,
                    deadline: finalDeadline,
                    description
                }),
            })
            setIsOpen(false)
            setTitle("")
            setAssignedToIds([])
            setPriority("MEDIUM")
            setDeadline("")
            setDeadlineTime("")
            setDescription("")
            onTaskCreated?.()
            router.refresh()
        } catch {
            console.error("Failed to create task")
        } finally {
            setLoading(false)
        }
    }

    const toggleUser = (userId: string) => {
        setAssignedToIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        )
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Add Task
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Create New Task</DialogTitle>
                        <DialogDescription>
                            Assign a new task to one or more employees.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="title" className="text-right">
                                Title
                            </Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-start gap-4">
                            <Label className="text-right pt-2">
                                Assign To
                            </Label>
                            <div className="col-span-3 border rounded-md max-h-40 overflow-y-auto p-2 space-y-2">
                                {users.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">Loading users...</p>
                                ) : (
                                    users.map(user => (
                                        <div key={user.id} className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                id={`user-${user.id}`}
                                                checked={assignedToIds.includes(user.id)}
                                                onChange={() => toggleUser(user.id)}
                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                            <Label htmlFor={`user-${user.id}`} className="cursor-pointer text-sm font-normal">
                                                {user.name || user.email}
                                            </Label>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="priority" className="text-right">
                                Priority
                            </Label>
                            <div className="col-span-3">
                                <Select value={priority} onValueChange={setPriority}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="LOW">Low</SelectItem>
                                        <SelectItem value="MEDIUM">Medium</SelectItem>
                                        <SelectItem value="HIGH">High</SelectItem>
                                        <SelectItem value="URGENT">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="deadline" className="text-right">
                                Deadline
                            </Label>
                            <div className="col-span-3 flex gap-2">
                                <Input
                                    id="deadline"
                                    type="date"
                                    value={deadline}
                                    onChange={(e) => setDeadline(e.target.value)}
                                    className="flex-1"
                                />
                                <Input
                                    type="time"
                                    value={deadlineTime}
                                    onChange={(e) => setDeadlineTime(e.target.value)}
                                    className="w-32"
                                    placeholder="Time"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>Create Task</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
