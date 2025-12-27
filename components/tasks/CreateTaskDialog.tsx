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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil } from "lucide-react"

interface CreateTaskDialogProps {
    users: { id: string; name: string | null; email: string | null }[]
    onTaskCreated?: () => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    task?: any // Making flexible to accept task object
    mode?: 'create' | 'edit'
    open?: boolean
    onOpenChange?: (open: boolean) => void
    currentUserId?: string
}

export function CreateTaskDialog({ users: initialUsers, onTaskCreated, task, mode = 'create', open: controlledOpen, onOpenChange: setControlledOpen, currentUserId }: CreateTaskDialogProps) {
    const router = useRouter()
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false)

    // Use controlled state if provided, otherwise internal state
    const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen
    const setIsOpen = setControlledOpen || setUncontrolledOpen

    const [title, setTitle] = useState("")
    const [assignedToIds, setAssignedToIds] = useState<string[]>([])
    const [priority, setPriority] = useState("MEDIUM")
    const [deadline, setDeadline] = useState("")
    const [deadlineTime, setDeadlineTime] = useState("")
    const [description, setDescription] = useState("")
    const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string | null }>>([])
    const [loading, setLoading] = useState(false)


    useEffect(() => {
        if (isOpen) {
            // Initialize users list
            if (initialUsers && initialUsers.length > 0) {
                setUsers(initialUsers)
                if (mode === 'create') {
                    // If currentUserId is provided, mark it as default
                    if (currentUserId && initialUsers.some(u => u.id === currentUserId)) {
                        setAssignedToIds([currentUserId])
                    } else if (initialUsers.length === 1) {
                        setAssignedToIds([initialUsers[0].id])
                    }
                }
            } else {
                fetch("/api/team?all=true")
                    .then(res => res.json())
                    .then(data => {
                        setUsers(data)
                        if (mode === 'create') {
                            // If currentUserId is provided, mark it as default
                            if (currentUserId && Array.isArray(data) && data.some((u: { id: string }) => u.id === currentUserId)) {
                                setAssignedToIds([currentUserId])
                            } else if (Array.isArray(data) && data.length === 1) {
                                setAssignedToIds([data[0].id])
                            }
                        }
                    })
                    .catch(() => {
                        console.error("Failed to load users")
                        setUsers([])
                    })
            }

            // If in edit mode, populate fields
            if (mode === 'edit' && task) {
                setTitle(task.title || "")
                setDescription(task.description || "")
                setPriority(task.priority || "MEDIUM")

                if (task.deadline) {
                    const d = new Date(task.deadline)
                    setDeadline(d.toISOString().split('T')[0])
                    // Only set time if it's not midnight (or if we have a way to know it was set, but for now assumption is if time part exists)
                    // Check if it's not midnight (UTC) which we treat as "date only"
                    if (!(d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0)) {
                        // Format local time
                        const hours = String(d.getHours()).padStart(2, '0')
                        const minutes = String(d.getMinutes()).padStart(2, '0')
                        setDeadlineTime(`${hours}:${minutes}`)
                    }
                }

                // Handle participants/assignees mapping
                // task.assignees or task.participants depending on where it comes from
                // From Calendar it is mapped to participants, from Task list it might be assignees
                // Let's handle both
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const assignees = task.assignees || (task.participants ? task.participants.map((p: any) => p.user) : [])
                if (assignees) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    setAssignedToIds(assignees.map((u: any) => u.id))
                }
            } else if (mode === 'create') {
                // Reset fields
                setTitle("")
                // Set default assigned user if currentUserId is provided
                if (currentUserId && users.some(u => u.id === currentUserId)) {
                    setAssignedToIds([currentUserId])
                } else {
                    setAssignedToIds([])
                }
                setPriority("MEDIUM")
                setDeadline("")
                setDeadlineTime("")
                setDescription("")
            }
        }
    }, [isOpen, initialUsers, mode, task, currentUserId, users])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            let finalDeadline = null;
            if (deadline) {
                if (deadlineTime) {
                    finalDeadline = new Date(`${deadline}T${deadlineTime}:00`).toISOString()
                } else {
                    // Start of day UTC for date-only
                    finalDeadline = new Date(deadline).toISOString()
                }
            }

            const url = mode === 'edit' ? `/api/tasks/${task.id}` : "/api/tasks"
            const method = mode === 'edit' ? "PATCH" : "POST"

            await fetch(url, {
                method: method,
                body: JSON.stringify({
                    title,
                    assignedToIds,
                    priority,
                    deadline: finalDeadline,
                    description
                }),
            })
            setIsOpen(false)
            if (mode === 'create') {
                setTitle("")
                setAssignedToIds([])
                setPriority("MEDIUM")
                setDeadline("")
                setDeadlineTime("")
                setDescription("")
            }
            onTaskCreated?.()
            router.refresh()
        } catch {
            console.error(`Failed to ${mode} task`)
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
            {mode === 'create' && (
                <DialogTrigger asChild>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Add Task
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{mode === 'edit' ? 'Edit Task' : 'Create New Task'}</DialogTitle>
                        <DialogDescription>
                            {mode === 'edit' ? 'Update task details and assignments.' : 'Assign a new task to one or more employees.'}
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
                            <Label htmlFor="description" className="text-right pt-2">
                                Description
                            </Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="col-span-3"
                                placeholder="Add task description..."
                                aria-label="Task description"
                            />
                        </div>

                        {/* Only show assignment if there are users loaded */}
                        {(users.length > 0) && (
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label className="text-right pt-2">
                                    Assign To
                                </Label>
                                <div className="col-span-3 border rounded-md max-h-40 overflow-y-auto p-2 space-y-2">
                                    {users.map(user => (
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
                                                {currentUserId && user.id === currentUserId && (
                                                    <span className="text-muted-foreground ml-1">(you)</span>
                                                )}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

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
                                    id="deadline-time"
                                    type="time"
                                    value={deadlineTime}
                                    onChange={(e) => setDeadlineTime(e.target.value)}
                                    className="w-32"
                                    placeholder="Time"
                                    aria-label="Deadline time"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {mode === 'edit' ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                            {mode === 'edit' ? 'Update Task' : 'Create Task'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
