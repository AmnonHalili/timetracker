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
import { Checkbox } from "@/components/ui/checkbox"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil } from "lucide-react"
import { useLanguage } from "@/lib/useLanguage"

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
    const { t } = useLanguage()
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
    const [showToMe, setShowToMe] = useState(false)


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
                    const assigneeIds = assignees.map((u: any) => u.id)
                    setAssignedToIds(assigneeIds)
                    // Set showToMe if current user is in assignees
                    if (currentUserId && assigneeIds.includes(currentUserId)) {
                        setShowToMe(true)
                    } else {
                        setShowToMe(false)
                    }
                }
            } else if (mode === 'create') {
                // Reset fields
                setTitle("")
                // Set default assigned user if currentUserId is provided
                if (currentUserId && users.some(u => u.id === currentUserId)) {
                    setAssignedToIds([currentUserId])
                    setShowToMe(true) // Default to showing to creator
                } else {
                    setAssignedToIds([])
                    setShowToMe(false)
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

            // If "showToMe" is checked, ensure currentUserId is in assignedToIds
            let finalAssignedToIds = [...assignedToIds]
            if (showToMe && currentUserId && !finalAssignedToIds.includes(currentUserId)) {
                // Add currentUserId if showToMe is checked but user is not in assignedToIds
                finalAssignedToIds.push(currentUserId)
            } else if (!showToMe && currentUserId && finalAssignedToIds.includes(currentUserId)) {
                // Remove currentUserId only if showToMe is unchecked AND user is not manually selected in Assign To
                // If user manually selected themselves in Assign To, keep them even if showToMe is unchecked
                if (!assignedToIds.includes(currentUserId)) {
                    finalAssignedToIds = finalAssignedToIds.filter(id => id !== currentUserId)
                }
            }

            const url = mode === 'edit' ? `/api/tasks/${task.id}` : "/api/tasks"
            const method = mode === 'edit' ? "PATCH" : "POST"

            await fetch(url, {
                method: method,
                body: JSON.stringify({
                    title,
                    assignedToIds: finalAssignedToIds,
                    priority,
                    deadline: finalDeadline,
                    description
                }),
            })
            setIsOpen(false)
            if (mode === 'create') {
                setTitle("")
                if (currentUserId && users.some(u => u.id === currentUserId)) {
                    setAssignedToIds([currentUserId])
                    setShowToMe(true)
                } else {
                    setAssignedToIds([])
                    setShowToMe(false)
                }
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
        setAssignedToIds(prev => {
            const newIds = prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
            
            // If current user is being toggled, sync showToMe state
            if (currentUserId && userId === currentUserId) {
                setShowToMe(newIds.includes(currentUserId))
            }
            
            return newIds
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {mode === 'create' && (
                <DialogTrigger asChild>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> {t('tasks.addTask')}
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[425px] [&>button]:left-4 [&>button]:right-auto">
                <form onSubmit={handleSubmit}>
                    <DialogHeader className="text-right">
                        <DialogTitle className="text-right">{mode === 'edit' ? t('tasks.edit') : t('tasks.createNewTask')}</DialogTitle>
                        <DialogDescription className="text-right">
                            {mode === 'edit' ? t('tasks.edit') : t('tasks.assignNewTask')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="title" className="text-right">
                                {t('tasks.titleLabel')}
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
                                {t('tasks.description')}
                            </Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="col-span-3"
                                placeholder={t('tasks.addTaskDescription')}
                                aria-label={t('tasks.description')}
                            />
                        </div>

                        {/* Only show assignment if there are users loaded */}
                        {(users.length > 0) && (
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label className="text-right pt-2">
                                    {t('tasks.assignTo')}
                                </Label>
                                <div className="col-span-3 border rounded-md max-h-40 overflow-y-auto p-2 space-y-2">
                                    {users.map(user => (
                                        <div key={user.id} className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                id={`user-${user.id}`}
                                                checked={assignedToIds.includes(user.id)}
                                                onChange={() => toggleUser(user.id)}
                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary flex-shrink-0"
                                            />
                                            <Label htmlFor={`user-${user.id}`} className="cursor-pointer text-sm font-normal">
                                                {user.name || user.email}
                                                {currentUserId && user.id === currentUserId && (
                                                    <span className="text-muted-foreground ml-1">{t('common.you')}</span>
                                                )}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Show to me checkbox - only in create mode */}
                        {mode === 'create' && currentUserId && (
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">
                                    {/* Empty label for alignment */}
                                </Label>
                                <div className="col-span-3 flex items-center space-x-2">
                                    <Checkbox
                                        id="showToMe"
                                        checked={showToMe}
                                        onCheckedChange={(checked) => setShowToMe(checked as boolean)}
                                    />
                                    <Label htmlFor="showToMe" className="cursor-pointer text-sm font-normal">
                                        {t('tasks.showThisTaskToMe')}
                                    </Label>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="priority" className="text-right">
                                {t('tasks.priority')}
                            </Label>
                            <div className="col-span-3">
                                <Select value={priority} onValueChange={setPriority}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('tasks.priority')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="LOW">{t('tasks.priorityLow')}</SelectItem>
                                        <SelectItem value="MEDIUM">{t('tasks.priorityMedium')}</SelectItem>
                                        <SelectItem value="HIGH">{t('tasks.priorityHigh')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="deadline" className="text-right">
                                {t('tasks.deadline')}
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
                                    placeholder={t('tasks.deadline')}
                                    aria-label={t('tasks.deadline')}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="justify-end">
                        <Button type="submit" disabled={loading}>
                            {mode === 'edit' ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                            {mode === 'edit' ? t('tasks.edit') : t('tasks.create')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
