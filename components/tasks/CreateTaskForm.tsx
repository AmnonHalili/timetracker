"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { useLanguage } from "@/lib/useLanguage"
import { cn } from "@/lib/utils"
import { toast } from "sonner" // Assuming sonner is used, or update to use toast hook

interface CreateTaskFormProps {
    users: { id: string; name: string | null; email: string | null; managerId?: string | null; role?: string }[]
    onTaskCreated?: () => void
    onOptimisticTaskCreate?: (task: any) => void
    task?: any
    mode?: 'create' | 'edit'
    currentUserId?: string
    onSuccess: () => void
    onCancel: () => void
}

export function CreateTaskForm({
    users: initialUsers,
    onTaskCreated,
    onOptimisticTaskCreate,
    task,
    mode = 'create',
    currentUserId,
    onSuccess,
    onCancel
}: CreateTaskFormProps) {
    const router = useRouter()
    const { t, isRTL } = useLanguage()

    const [title, setTitle] = useState("")
    const [assignedToIds, setAssignedToIds] = useState<string[]>([])
    const [priority, setPriority] = useState("LOW")
    const [startDate, setStartDate] = useState("")
    const [startDateTime, setStartDateTime] = useState("")
    const [deadline, setDeadline] = useState("")
    const [deadlineTime, setDeadlineTime] = useState("")
    const [description, setDescription] = useState("")
    const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string | null; managerId?: string | null; role?: string; depth?: number }>>([])
    const [loading, setLoading] = useState(false)
    const [showToMe, setShowToMe] = useState(true)

    // Subtasks State
    const [subtasks, setSubtasks] = useState<Array<{ id: string; title: string; priority: string; assignedToId: string | null; dueDate: string | null; isDone: boolean }>>([])
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
    const [newSubtaskPriority, setNewSubtaskPriority] = useState("LOW")
    const [newSubtaskAssignee, setNewSubtaskAssignee] = useState<string | null>(null)
    const [newSubtaskDueDate, setNewSubtaskDueDate] = useState("")
    const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(false)

    // Helper to sort users: Current User first, then Hierarchy
    const sortUsersHierarchically = (usersToSort: Array<{ id: string; name: string | null; email: string | null; managerId?: string | null; role?: string }>, meId?: string) => {
        if (!usersToSort.length) return [];

        let me: typeof users[0] | undefined;
        const others = usersToSort.map(u => ({ ...u, depth: 0 }));

        if (meId) {
            const meIndex = others.findIndex(u => u.id === meId);
            if (meIndex >= 0) {
                me = others[meIndex];
                others.splice(meIndex, 1);
            }
        }

        const userMap = new Map<string, typeof users[0]>();
        const childrenMap = new Map<string, typeof users[0][]>();

        others.forEach(u => {
            userMap.set(u.id, u);
            if (!childrenMap.has(u.id)) childrenMap.set(u.id, []);
        });

        const roots: typeof users = [];

        others.forEach(u => {
            if (u.managerId && userMap.has(u.managerId)) {
                childrenMap.get(u.managerId)?.push(u);
            } else {
                roots.push(u);
            }
        });

        const flattened: typeof users = [];
        const traverse = (nodes: typeof users, currentDepth: number) => {
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
        // Initialize users list
        if (initialUsers && initialUsers.length > 0) {
            const compatibleUsers = initialUsers as Array<{ id: string; name: string | null; email: string | null; managerId?: string | null; role?: string; depth?: number }>;
            setUsers(sortUsersHierarchically(compatibleUsers, currentUserId))
            if (mode === 'create') {
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

        if (mode === 'edit' && task) {
            setTitle(task.title || "")
            setDescription(task.description || "")
            setPriority(task.priority || "LOW")

            if (task.startDate) {
                const d = new Date(task.startDate)
                setStartDate(d.toISOString().split('T')[0])
                if (!(d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0)) {
                    const hours = String(d.getHours()).padStart(2, '0')
                    const minutes = String(d.getMinutes()).padStart(2, '0')
                    setStartDateTime(`${hours}:${minutes}`)
                } else {
                    setStartDateTime("")
                }
            } else {
                setStartDate("")
                setStartDateTime("")
            }

            if (task.deadline) {
                const d = new Date(task.deadline)
                setDeadline(d.toISOString().split('T')[0])
                if (!(d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0)) {
                    const hours = String(d.getHours()).padStart(2, '0')
                    const minutes = String(d.getMinutes()).padStart(2, '0')
                    setDeadlineTime(`${hours}:${minutes}`)
                }
            }

            const assignees = task.assignees || (task.participants ? task.participants.map((p: any) => p.user) : [])
            if (assignees) {
                const assigneeIds = assignees.map((u: any) => u.id)
                setAssignedToIds(assigneeIds)
            }
        } else if (mode === 'create') {
            setTitle("")
            setAssignedToIds([])
            setShowToMe(true)
            setPriority("LOW")
            setStartDate("")
            setStartDateTime("")
            setDeadline("")
            setDeadlineTime("")
            setDescription("")
        }
    }, [initialUsers, mode, task, currentUserId])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        let finalStartDate = null;
        if (startDate) {
            if (startDateTime) {
                finalStartDate = new Date(`${startDate}T${startDateTime}:00`).toISOString()
            } else {
                finalStartDate = new Date(startDate).toISOString()
            }
        }

        let finalDeadline = null;
        if (deadline) {
            if (deadlineTime) {
                finalDeadline = new Date(`${deadline}T${deadlineTime}:00`).toISOString()
            } else {
                finalDeadline = new Date(deadline).toISOString()
            }
        }

        let finalAssignedToIds = [...assignedToIds]
        if (showToMe && currentUserId && !finalAssignedToIds.includes(currentUserId)) {
            finalAssignedToIds.push(currentUserId)
        } else if (!showToMe && currentUserId && finalAssignedToIds.includes(currentUserId)) {
            const wasManuallySelected = assignedToIds.includes(currentUserId)
            if (!wasManuallySelected) {
                finalAssignedToIds = finalAssignedToIds.filter(id => id !== currentUserId)
            }
        }

        if (onOptimisticTaskCreate) {
            const optimisticTask = {
                id: mode === 'edit' && task ? task.id : `temp-${Date.now()}`,
                title,
                priority,
                startDate: finalStartDate ? new Date(finalStartDate) : null,
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
                createdAt: mode === 'edit' && task ? task.createdAt : new Date(),
                updatedAt: new Date(),
                subtasks: subtasks,
                checklist: mode === 'edit' && task ? task.checklist : []
            }

            onOptimisticTaskCreate(optimisticTask)
            onSuccess() // Close dialog

            if (mode === 'create') {
                setTitle("")
                setAssignedToIds([])
                setShowToMe(true)
                setPriority("LOW")
                setStartDate("")
                setStartDateTime("")
                setDeadline("")
                setDeadlineTime("")
                setDescription("")
                setSubtasks([])
                setNewSubtaskTitle("")
                setNewSubtaskPriority("LOW")
                setNewSubtaskAssignee(null)
                setNewSubtaskDueDate("")
                setIsSubtasksExpanded(false)
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
                    startDate: finalStartDate,
                    deadline: finalDeadline,
                    description,
                    subtasks
                }),
            })

            if (!response.ok) {
                throw new Error(`Failed to ${mode} task`)
            }

            if (mode === 'edit') {
                toast.success(t('tasks.taskUpdated') || "Task updated successfully")
                onSuccess()
            } else {
                toast.success(t('tasks.taskCreated') || "Task created successfully")
            }

            onTaskCreated?.()
            router.refresh()
        } catch (error) {
            console.error(`Failed to ${mode} task:`, error)
            toast.error(t('tasks.errorCreatingTask') || "Failed to create task. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const toggleUser = (userId: string) => {
        setAssignedToIds(prev => {
            const newIds = prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
            return newIds
        })
    }

    const handleAddSubtask = () => {
        if (!newSubtaskTitle.trim()) return

        const newSubtask = {
            id: `temp-${Date.now()}`,
            title: newSubtaskTitle,
            priority: newSubtaskPriority,
            assignedToId: newSubtaskAssignee,
            dueDate: newSubtaskDueDate || null,
            isDone: false
        }

        setSubtasks(prev => [...prev, newSubtask])
        setNewSubtaskTitle("")
        setNewSubtaskPriority("LOW")
        setNewSubtaskAssignee(null)
        setNewSubtaskDueDate("")
    }

    const handleDeleteSubtask = (id: string) => {
        setSubtasks(prev => prev.filter(st => st.id !== id))
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="grid gap-6 py-4 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="title" className="text-base font-semibold">
                            {t('tasks.titleLabel')}
                        </Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="h-10 border-input bg-transparent"
                            required
                            placeholder={t('tasks.titlePlaceholder') || "Task title"}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="priority" className="text-base font-semibold">
                            {t('tasks.priority')}
                        </Label>
                        <Select value={priority} onValueChange={setPriority}>
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder={t('tasks.priority')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LOW">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                        {t('tasks.priorityLow')}
                                    </div>
                                </SelectItem>
                                <SelectItem value="MEDIUM">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                        {t('tasks.priorityMedium')}
                                    </div>
                                </SelectItem>
                                <SelectItem value="HIGH">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                        {t('tasks.priorityHigh')}
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="description" className="text-base font-semibold">
                        {t('tasks.description')}
                    </Label>
                    <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="min-h-[100px] resize-y"
                        placeholder={t('tasks.addTaskDescription')}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="startDate" className="text-base font-semibold">
                            {t('tasks.startDate') || 'Start Date'}
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                id="startDate"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="h-10"
                            />
                            <Input
                                id="startDate-time"
                                type="time"
                                value={startDateTime}
                                onChange={(e) => setStartDateTime(e.target.value)}
                                className="h-10 w-[110px]"
                            />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="deadline" className="text-base font-semibold">
                            {t('tasks.deadline')}
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                id="deadline"
                                type="date"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                                className="h-10"
                            />
                            <Input
                                id="deadline-time"
                                type="time"
                                value={deadlineTime}
                                onChange={(e) => setDeadlineTime(e.target.value)}
                                className="h-10 w-[110px]"
                            />
                        </div>
                    </div>
                </div>

                {(users.length > 0) && (
                    <div className="grid gap-2">
                        <Label className="text-base font-semibold">
                            {t('tasks.assignTo')}
                        </Label>
                        <div className="border rounded-md max-h-48 overflow-y-auto p-3 space-y-2 bg-background/50">
                            {users.map(user => (
                                <div key={user.id} className="flex items-center gap-3 p-1 rounded hover:bg-muted/50 transition-colors" style={{ paddingInlineStart: `${(user.depth || 0) * 1.5}rem` }}>
                                    <Checkbox
                                        id={`user-${user.id}`}
                                        checked={assignedToIds.includes(user.id)}
                                        onCheckedChange={() => toggleUser(user.id)}
                                    />
                                    <Label htmlFor={`user-${user.id}`} className="cursor-pointer text-sm font-medium flex-1">
                                        {user.name || user.email}
                                        {currentUserId && user.id === currentUserId && (
                                            <span className="text-muted-foreground ml-1 text-xs">({t('common.you')})</span>
                                        )}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {mode === 'create' && currentUserId && (
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="showToMe"
                            checked={showToMe}
                            onCheckedChange={(checked) => setShowToMe(checked as boolean)}
                        />
                        <Label htmlFor="showToMe" className="cursor-pointer font-medium">
                            {t('tasks.showThisTaskToMe')}
                        </Label>
                    </div>
                )}

                {/* Subtasks Section */}
                {mode === 'create' && (
                    <div className="border-t pt-4">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setIsSubtasksExpanded(!isSubtasksExpanded)}
                            className="w-full justify-between mb-4 group hover:bg-muted/50"
                        >
                            <span className="font-semibold text-lg flex items-center gap-2">
                                {t('tasks.subtasks') || 'Subtasks'}
                                {subtasks.length > 0 && (
                                    <Badge variant="secondary" className="px-2">
                                        {subtasks.length}
                                    </Badge>
                                )}
                            </span>
                            <div className="p-1 rounded-full bg-muted group-hover:bg-background transition-colors">
                                {isSubtasksExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                        </Button>

                        {isSubtasksExpanded && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="flex flex-col md:flex-row gap-3 p-4 bg-muted/40 rounded-xl border items-start md:items-center shadow-sm">
                                    <div className="flex-1 w-full md:w-auto">
                                        <Input
                                            placeholder={t('tasks.subtaskTitlePlaceholder') || "What needs to be done?"}
                                            value={newSubtaskTitle}
                                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                            className="h-9 bg-background"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    handleAddSubtask()
                                                }
                                            }}
                                        />
                                    </div>

                                    <div className="flex gap-2 w-full md:w-auto">
                                        <div className="w-[110px]">
                                            <Select value={newSubtaskPriority} onValueChange={setNewSubtaskPriority}>
                                                <SelectTrigger className="h-9 bg-background text-xs">
                                                    <SelectValue placeholder={t('tasks.priority')} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="LOW">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                            {t('tasks.priorityLow')}
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="MEDIUM">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                                                            {t('tasks.priorityMedium')}
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="HIGH">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                                            {t('tasks.priorityHigh')}
                                                        </div>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="w-[140px]">
                                            <Select
                                                value={newSubtaskAssignee || "unassigned"}
                                                onValueChange={(val) => setNewSubtaskAssignee(val === "unassigned" ? null : val)}
                                            >
                                                <SelectTrigger className="h-9 bg-background text-xs">
                                                    <SelectValue placeholder={t('tasks.assignTo')} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="unassigned">{t('tasks.subtaskNoAssignee') || 'Unassigned'}</SelectItem>
                                                    {users
                                                        .filter(user => assignedToIds.includes(user.id))
                                                        .map(user => (
                                                            <SelectItem key={user.id} value={user.id}>
                                                                {user.name || user.email}
                                                            </SelectItem>
                                                        ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <Input
                                            type="date"
                                            value={newSubtaskDueDate}
                                            onChange={(e) => setNewSubtaskDueDate(e.target.value)}
                                            className="h-9 w-[130px] text-xs bg-background"
                                        />

                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={handleAddSubtask}
                                            disabled={!newSubtaskTitle.trim()}
                                            className="h-9 w-9 p-0 shrink-0"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {subtasks.length > 0 && (
                                    <div className="border rounded-md overflow-hidden">
                                        <div className="bg-muted/50 px-4 py-2 border-b text-xs font-semibold text-muted-foreground flex items-center">
                                            <div className="flex-1">{t('tasks.subtaskTitlePlaceholder') || 'Title'}</div>
                                            <div className="w-[100px] hidden md:block">{t('tasks.priority')}</div>
                                            <div className="w-[120px] hidden md:block">{t('tasks.assignTo')}</div>
                                            <div className="w-[100px] hidden md:block">{t('tasks.dueDate') || 'Due Date'}</div>
                                            <div className="w-8"></div>
                                        </div>
                                        <div className="max-h-[200px] overflow-y-auto bg-background/50 divide-y">
                                            {subtasks.map((st) => (
                                                <div key={st.id} className="flex items-center px-4 py-2.5 hover:bg-muted/30 transition-colors group text-sm">
                                                    <div className="flex-1 font-medium flex items-center gap-2">
                                                        {st.title}
                                                        <div className="md:hidden flex gap-1">
                                                            <div className={cn(
                                                                "w-2 h-2 rounded-full",
                                                                st.priority === 'HIGH' ? "bg-red-500" :
                                                                    st.priority === 'MEDIUM' ? "bg-yellow-500" :
                                                                        "bg-green-500"
                                                            )} />
                                                        </div>
                                                    </div>

                                                    <div className="w-[100px] hidden md:flex items-center">
                                                        <Badge variant="outline" className={cn(
                                                            "h-6 text-[10px] gap-1.5 pl-1.5 pr-2.5",
                                                            st.priority === 'HIGH' ? "bg-red-50 text-red-700 border-red-200" :
                                                                st.priority === 'MEDIUM' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                                                                    "bg-green-50 text-green-700 border-green-200"
                                                        )}>
                                                            <div className={cn(
                                                                "w-1.5 h-1.5 rounded-full",
                                                                st.priority === 'HIGH' ? "bg-red-500" :
                                                                    st.priority === 'MEDIUM' ? "bg-yellow-500" :
                                                                        "bg-green-500"
                                                            )} />
                                                            {st.priority || 'LOW'}
                                                        </Badge>
                                                    </div>

                                                    <div className="w-[120px] hidden md:flex items-center text-muted-foreground text-xs">
                                                        {st.assignedToId ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary font-bold">
                                                                    {users.find(u => u.id === st.assignedToId)?.name?.charAt(0) || "U"}
                                                                </div>
                                                                <span className="truncate max-w-[85px]">
                                                                    {users.find(u => u.id === st.assignedToId)?.name || "User"}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="opacity-50">-</span>
                                                        )}
                                                    </div>

                                                    <div className="w-[100px] hidden md:flex items-center text-muted-foreground text-xs">
                                                        {st.dueDate ? st.dueDate : <span className="opacity-50">-</span>}
                                                    </div>

                                                    <div className="w-8 flex justify-end">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteSubtask(st.id)}
                                                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className={cn("flex items-center gap-2 mt-4 pt-4 border-t", isRTL ? "justify-start" : "justify-end")}>
                <Button type="button" variant="outline" onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={loading}>
                    {mode === 'edit' ? <Pencil className={cn(isRTL ? "ml-2" : "mr-2", "h-4 w-4")} /> : <Plus className={cn(isRTL ? "ml-2" : "mr-2", "h-4 w-4")} />}
                    {mode === 'edit' ? t('tasks.edit') : t('tasks.create')}
                </Button>
            </div>
        </form>
    )
}
