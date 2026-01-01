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
    users: { id: string; name: string | null; email: string | null; managerId?: string | null; role?: string }[]
    onTaskCreated?: () => void
    onOptimisticTaskCreate?: (task: {
        id: string
        title: string
        priority: string
        deadline: Date | null
        description: string | null
        status: string
        assignees: Array<{ id: string; name: string | null; email: string | null; managerId?: string | null; role?: string }>
        createdAt: Date
        updatedAt: Date
    }) => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    task?: any // Making flexible to accept task object
    mode?: 'create' | 'edit'
    open?: boolean
    onOpenChange?: (open: boolean) => void
    currentUserId?: string
}

export function CreateTaskDialog({ users: initialUsers, onTaskCreated, onOptimisticTaskCreate, task, mode = 'create', open: controlledOpen, onOpenChange: setControlledOpen, currentUserId }: CreateTaskDialogProps) {
    const router = useRouter()
    const { t } = useLanguage()
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false)

    // Use controlled state if provided, otherwise internal state
    const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen
    const setIsOpen = setControlledOpen || setUncontrolledOpen

    const [title, setTitle] = useState("")
    const [assignedToIds, setAssignedToIds] = useState<string[]>([])
    const [priority, setPriority] = useState("LOW")
    const [deadline, setDeadline] = useState("")
    const [deadlineTime, setDeadlineTime] = useState("")
    const [description, setDescription] = useState("")
    const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string | null; managerId?: string | null; role?: string; depth?: number }>>([])
    const [loading, setLoading] = useState(false)
    const [showToMe, setShowToMe] = useState(true) // Default to true - independent of Assign To

    // Helper to sort users: Current User first, then Hierarchy
    const sortUsersHierarchically = (usersToSort: Array<{ id: string; name: string | null; email: string | null; managerId?: string | null; role?: string }>, meId?: string) => {
        if (!usersToSort.length) return [];

        let me: typeof users[0] | undefined;
        const others = usersToSort.map(u => ({ ...u, depth: 0 })); // Initialize depth for all users

        // 1. Extract Me
        if (meId) {
            const meIndex = others.findIndex(u => u.id === meId);
            if (meIndex >= 0) {
                me = others[meIndex];
                others.splice(meIndex, 1);
            }
        }

        // 2. Build Tree
        const userMap = new Map<string, typeof users[0]>();
        const childrenMap = new Map<string, typeof users[0][]>();

        others.forEach(u => {
            userMap.set(u.id, u);
            if (!childrenMap.has(u.id)) childrenMap.set(u.id, []);
        });

        const roots: typeof users = [];

        others.forEach(u => {
            // If manager exists in the filtered list, add as child
            if (u.managerId && userMap.has(u.managerId)) {
                childrenMap.get(u.managerId)?.push(u);
            } else {
                // Otherwise it's a root (relative to this list)
                roots.push(u);
            }
        });

        // 3. DFS Flatten with Depth
        const flattened: typeof users = [];
        const traverse = (nodes: typeof users, currentDepth: number) => {
            // Sort siblings alphabetically or by role if needed
            nodes.sort((a, b) => (a.name || a.email || "").localeCompare(b.name || b.email || ""))
                .forEach(node => {
                    flattened.push({ ...node, depth: currentDepth });
                    const children = childrenMap.get(node.id);
                    if (children && children.length > 0) {
                        traverse(children, currentDepth + 1);
                    }
                });
        };

        traverse(roots, 0);

        return me ? [{ ...me, depth: 0 }, ...flattened] : flattened;
    }


    useEffect(() => {
        if (isOpen) {
            // Initialize users list
            if (initialUsers && initialUsers.length > 0) {
                // Cast initial users to compatible type (adding optional depth)
                const compatibleUsers = initialUsers as Array<{ id: string; name: string | null; email: string | null; managerId?: string | null; role?: string; depth?: number }>;
                setUsers(sortUsersHierarchically(compatibleUsers, currentUserId))
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
                        const sorted = sortUsersHierarchically(data, currentUserId)
                        setUsers(sorted)
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
                setPriority(task.priority || "LOW")

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
                    // showToMe is independent - default to true in create mode, keep current state in edit mode
                    // Don't sync with assignees - user can have showToMe checked even if not in assignees
                }
            } else if (mode === 'create') {
                // Reset fields
                setTitle("")
                setAssignedToIds([])
                setShowToMe(true) // Always default to true, independent of Assign To
                setPriority("LOW")
                setDeadline("")
                setDeadlineTime("")
                setDescription("")
            }
        }
    }, [isOpen, initialUsers, mode, task, currentUserId]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

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
        // This is independent of manual selection in Assign To
        let finalAssignedToIds = [...assignedToIds]
        if (showToMe && currentUserId && !finalAssignedToIds.includes(currentUserId)) {
            // Add currentUserId if showToMe is checked but user is not in assignedToIds
            finalAssignedToIds.push(currentUserId)
        } else if (!showToMe && currentUserId && finalAssignedToIds.includes(currentUserId)) {
            // Remove currentUserId only if showToMe is unchecked
            // But check if user was manually selected - if so, keep them
            // We track this by checking if currentUserId was in the original assignedToIds
            // If it wasn't there originally, it means it was added by showToMe, so we can remove it
            // If it was there originally, it means user selected themselves manually, so keep it
            const wasManuallySelected = assignedToIds.includes(currentUserId)
            if (!wasManuallySelected) {
                // Only remove if it was added by showToMe, not if manually selected
                finalAssignedToIds = finalAssignedToIds.filter(id => id !== currentUserId)
            }
        }

        // Optimistic update for create OR edit mode
        if (onOptimisticTaskCreate) {
            const optimisticTask = {
                id: mode === 'edit' && task ? task.id : `temp-${Date.now()}`,
                title,
                priority,
                deadline: finalDeadline ? new Date(finalDeadline) : null,
                description: description || null,
                status: mode === 'edit' && task ? task.status : "TODO",
                assignees: finalAssignedToIds.map(id => {
                    const user = users.find(u => u.id === id)
                    return {
                        id: id,
                        name: user?.name || null,
                        email: user?.email || null
                    }
                }),
                // Preserve existing or new
                createdAt: mode === 'edit' && task ? task.createdAt : new Date(),
                updatedAt: new Date(),
                // Preserve subtasks if editing
                subtasks: mode === 'edit' && task ? task.subtasks : [],
                // Preserve checklist if editing
                checklist: mode === 'edit' && task ? task.checklist : []
            }

            onOptimisticTaskCreate(optimisticTask)
            setIsOpen(false)

            // Reset form immediately if creating, but not strict for edit as modal closes
            if (mode === 'create') {
                setTitle("")
                setAssignedToIds([])
                setShowToMe(true)
                setPriority("LOW")
                setDeadline("")
                setDeadlineTime("")
                setDescription("")
            }
        } else {
            setLoading(true)
        }

        try {
            const url = mode === 'edit' ? `/api/tasks/${task.id}` : "/api/tasks"
            const method = mode === 'edit' ? "PATCH" : "POST"

            const response = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title,
                    assignedToIds: finalAssignedToIds,
                    priority,
                    deadline: finalDeadline,
                    description
                }),
            })

            if (!response.ok) {
                throw new Error(`Failed to ${mode} task`)
            }

            // For edit mode, close dialog after successful update
            if (mode === 'edit') {
                setIsOpen(false)
            }

            // Refresh data in background
            onTaskCreated?.()
            router.refresh()
        } catch (error) {
            console.error(`Failed to ${mode} task:`, error)
            // If optimistic update was used, we should revert it
            // But since we're refreshing, the server data will correct it
        } finally {
            setLoading(false)
        }
    }

    const toggleUser = (userId: string) => {
        setAssignedToIds(prev => {
            const newIds = prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]

            // showToMe is now independent - don't sync it with manual selection
            // User can select themselves in Assign To and still have showToMe unchecked
            // Or have showToMe checked without selecting themselves in Assign To

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
            <DialogContent className="sm:max-w-[425px]" dir="ltr">
                <form onSubmit={handleSubmit}>
                    <DialogHeader className="text-left">
                        <DialogTitle className="text-left">{mode === 'edit' ? t('tasks.edit') : t('tasks.createNewTask')}</DialogTitle>
                        <DialogDescription className="text-left">
                            {mode === 'edit' ? t('tasks.edit') : t('tasks.assignNewTask')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="title">
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
                            <Label htmlFor="description" className="pt-2">
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
                                <Label className="pt-2">
                                    {t('tasks.assignTo')}
                                </Label>
                                <div className="col-span-3 border rounded-md max-h-40 overflow-y-auto p-2 space-y-2">
                                    {users.map(user => (
                                        <div key={user.id} className="flex items-center gap-3" style={{ paddingInlineStart: `${(user.depth || 0) * 1.25}rem` }}>
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
                                <Label>
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
                            <Label htmlFor="priority">
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
                            <Label htmlFor="deadline">
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
                    <DialogFooter className="justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                            {t('common.cancel')}
                        </Button>
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
