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
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Search, Calendar, UserPlus, Clock, AlertCircle, FolderKanban } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useLanguage } from "@/lib/useLanguage"
import { TranslationKey } from "@/lib/translations"
import { cn } from "@/lib/utils"
import { toast } from "sonner" // Assuming sonner is used, or update to use toast hook

interface CreateTaskFormProps {
    users: { id: string; name: string | null; email: string | null; managerId?: string | null; role?: string }[]
    onTaskCreated?: () => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onOptimisticTaskCreate?: (task: any) => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const [priority, setPriority] = useState("NONE")
    const [startDate, setStartDate] = useState("")
    const [startDateTime, setStartDateTime] = useState("")
    const [deadline, setDeadline] = useState("")
    const [deadlineTime, setDeadlineTime] = useState("")
    const [description, setDescription] = useState("")
    const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string | null; managerId?: string | null; role?: string; depth?: number }>>([])
    const [loading, setLoading] = useState(false)
    const [showToMe, setShowToMe] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")

    // Subtasks State
    const [subtasks, setSubtasks] = useState<Array<{ id: string; title: string; priority: string; assignedToId: string | null; startDate: string | null; dueDate: string | null; isDone: boolean }>>([])
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
    const [newSubtaskPriority, setNewSubtaskPriority] = useState("NONE")
    const [newSubtaskAssignee, setNewSubtaskAssignee] = useState<string | null>(null)
    const [newSubtaskStartDate, setNewSubtaskStartDate] = useState("")
    const [newSubtaskStartDateTime, setNewSubtaskStartDateTime] = useState("")
    const [newSubtaskDueDate, setNewSubtaskDueDate] = useState("")
    const [newSubtaskDueDateTime, setNewSubtaskDueDateTime] = useState("")
    const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(false)

    useEffect(() => {
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
            setPriority(task.priority || "NONE")

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

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const assignees = task.assignees || (task.participants ? task.participants.map((p: any) => p.user) : [])
            if (assignees) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const assigneeIds = assignees.map((u: any) => u.id)
                setAssignedToIds(assigneeIds)
            }
        } else if (mode === 'create') {
            setTitle("")
            setAssignedToIds([])
            setShowToMe(true)
            setPriority("NONE")
            setStartDate("")
            setStartDateTime("")
            setDeadline("")
            setDeadlineTime("")
            setDescription("")
        }
    }, [initialUsers, mode, task, currentUserId])

    const filteredUsers = users.filter(user => {
        const nameMatch = (user.name || "").toLowerCase().includes(searchTerm.toLowerCase())
        const emailMatch = (user.email || "").toLowerCase().includes(searchTerm.toLowerCase())
        return nameMatch || emailMatch
    })

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
                setPriority("NONE")
                setStartDate("")
                setStartDateTime("")
                setDeadline("")
                setDeadlineTime("")
                setDescription("")
                setSubtasks([])
                setNewSubtaskTitle("")
                setNewSubtaskPriority("NONE")
                setNewSubtaskAssignee(null)
                setNewSubtaskStartDate("")
                setNewSubtaskStartDateTime("")
                setNewSubtaskDueDate("")
                setNewSubtaskDueDateTime("")
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

        let finalStartDate = null
        if (newSubtaskStartDate) {
            if (newSubtaskStartDateTime) {
                finalStartDate = new Date(`${newSubtaskStartDate}T${newSubtaskStartDateTime}:00`).toISOString()
            } else {
                finalStartDate = new Date(newSubtaskStartDate).toISOString()
            }
        }

        let finalDueDate = null
        if (newSubtaskDueDate) {
            if (newSubtaskDueDateTime) {
                finalDueDate = new Date(`${newSubtaskDueDate}T${newSubtaskDueDateTime}:00`).toISOString()
            } else {
                finalDueDate = new Date(newSubtaskDueDate).toISOString()
            }
        }

        const newSubtask = {
            id: `temp-${Date.now()}`,
            title: newSubtaskTitle,
            priority: newSubtaskPriority,
            assignedToId: newSubtaskAssignee,
            startDate: finalStartDate,
            dueDate: finalDueDate,
            isDone: false
        }

        setSubtasks(prev => [...prev, newSubtask])
        setNewSubtaskTitle("")
        setNewSubtaskPriority("LOW")
        setNewSubtaskAssignee(null)
        setNewSubtaskStartDate("")
        setNewSubtaskStartDateTime("")
        setNewSubtaskDueDate("")
        setNewSubtaskDueDateTime("")
    }

    const handleDeleteSubtask = (id: string) => {
        setSubtasks(prev => prev.filter(st => st.id !== id))
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="space-y-6 pt-4 pb-24 flex-1 overflow-y-auto px-1 custom-scrollbar">
                {/* General Info Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                            <FolderKanban className="h-4 w-4" />
                        </div>
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            {t('tasks.generalInfo') || 'General Information'}
                        </h3>
                    </div>

                    <div className="grid gap-4">
                        {/* 1. Title */}
                        <div className="grid gap-2">
                            <Label htmlFor="title" className="text-sm font-medium flex items-center gap-1.5">
                                {t('tasks.titleLabel')}
                                <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="h-11 border-input bg-background/50 focus:bg-background transition-all text-base shadow-sm"
                                required
                                placeholder={t('tasks.titlePlaceholder') || "Enter task title..."}
                            />
                        </div>

                        {/* 2. Description */}
                        <div className="grid gap-2">
                            <Label htmlFor="description" className="text-sm font-medium">
                                {t('tasks.description')}
                            </Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="min-h-[100px] resize-none bg-background/50 focus:bg-background transition-all border-input shadow-sm p-3"
                                placeholder={t('tasks.addTaskDescription')}
                            />
                        </div>

                        {/* 3. Priority */}
                        <div className="grid gap-2">
                            <Label className="text-sm font-medium">{t('tasks.priority')}</Label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { value: 'NONE', label: t('tasks.priorityNone') || 'None', color: 'bg-muted-foreground/10 text-muted-foreground border-transparent', activeColor: 'bg-muted-foreground/20 text-muted-foreground border-muted-foreground/50 ring-2 ring-muted-foreground/20', dot: 'bg-muted-foreground/40' },
                                    { value: 'LOW', label: t('tasks.priorityLow'), color: 'bg-emerald-50 text-emerald-700 border-emerald-100', activeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 ring-2 ring-emerald-100', dot: 'bg-emerald-500' },
                                    { value: 'MEDIUM', label: t('tasks.priorityMedium'), color: 'bg-amber-50 text-amber-700 border-amber-100', activeColor: 'bg-amber-100 text-amber-800 border-amber-300 ring-2 ring-amber-100', dot: 'bg-amber-500' },
                                    { value: 'HIGH', label: t('tasks.priorityHigh'), color: 'bg-rose-50 text-rose-700 border-rose-100', activeColor: 'bg-rose-100 text-rose-800 border-rose-300 ring-2 ring-rose-100', dot: 'bg-rose-500' },
                                ].map((p) => (
                                    <button
                                        key={p.value}
                                        type="button"
                                        onClick={() => setPriority(p.value)}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all duration-200",
                                            priority === p.value ? p.activeColor : p.color,
                                            "hover:translate-y-[-1px] active:translate-y-[0px] shadow-sm"
                                        )}
                                    >
                                        <div className={cn("w-2 h-2 rounded-full", p.dot)} />
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <Separator className="my-2" />

                {/* 4. Assign To Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                                <UserPlus className="h-4 w-4" />
                            </div>
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                {t('tasks.assignTo')}
                            </h3>
                        </div>
                        {assignedToIds.length > 0 && (
                            <Badge variant="secondary" className="px-2 py-0.5 text-[10px] font-bold">
                                {assignedToIds.length} {t('tasks.selected') || 'Selected'}
                            </Badge>
                        )}
                    </div>

                    <div className="space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={t('tasks.searchTeam') || "Search team members..."}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-10 bg-background/50 border-input shadow-xs focus:bg-background transition-all"
                            />
                        </div>

                        <div className="border rounded-xl bg-background/30 overflow-hidden">
                            <ScrollArea className="h-48">
                                <div className="p-1">
                                    {filteredUsers.length > 0 ? (
                                        filteredUsers.map(user => (
                                            <div
                                                key={user.id}
                                                className={cn(
                                                    "flex items-center gap-3 p-2 rounded-lg transition-all cursor-pointer group",
                                                    assignedToIds.includes(user.id) ? "bg-primary/5" : "hover:bg-muted/50"
                                                )}
                                                onClick={() => toggleUser(user.id)}
                                            >
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <Checkbox
                                                        id={`user-${user.id}`}
                                                        checked={assignedToIds.includes(user.id)}
                                                        onCheckedChange={() => toggleUser(user.id)}
                                                        className="rounded-full h-5 w-5"
                                                        style={{ marginInlineStart: `${(user.depth || 0) * 1}rem` }}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <Avatar className="h-8 w-8 border-2 border-background shadow-xs">
                                                        <AvatarImage src={`/api/users/${user.id}/avatar`} />
                                                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                                                            {user.name?.charAt(0) || user.email?.charAt(0) || "?"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-semibold truncate">
                                                            {user.name || user.email}
                                                            {currentUserId && user.id === currentUserId && (
                                                                <span className="text-muted-foreground ml-1 font-normal opacity-70">({t('common.you')})</span>
                                                            )}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground truncate opacity-70">
                                                            {user.email}
                                                        </span>
                                                    </div>
                                                </div>
                                                {assignedToIds.includes(user.id) && (
                                                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse mr-2" />
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-8 text-center text-muted-foreground">
                                            <p className="text-sm italic">{t('common.noResults') || 'No members found'}</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>

                    {mode === 'create' && currentUserId && (
                        <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-dashed border-muted-foreground/20 mt-2">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="showToMe"
                                    checked={showToMe}
                                    onCheckedChange={(checked) => setShowToMe(checked as boolean)}
                                    className="rounded-sm"
                                />
                                <Label htmlFor="showToMe" className="text-sm font-medium cursor-pointer">
                                    {t('tasks.showThisTaskToMe')}
                                </Label>
                            </div>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <AlertCircle className="h-4 w-4 text-muted-foreground/50 cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-[200px] text-[10px]">
                                        {t('tasks.showToMeHint') || 'Automatically add yourself as an assignee and follower.'}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    )}
                </div>

                <Separator className="my-2" />

                {/* 5. Schedule Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                            <Clock className="h-4 w-4" />
                        </div>
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            {t('tasks.schedule') || 'Schedule'}
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="startDate" className="text-sm font-medium flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                {t('tasks.startDate') || 'Start Date'}
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="startDate"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="h-10 border-input bg-background/50 focus:bg-background transition-all"
                                />
                                <Input
                                    id="startDate-time"
                                    type="time"
                                    value={startDateTime}
                                    onChange={(e) => setStartDateTime(e.target.value)}
                                    className="h-10 w-[110px] border-input bg-background/50 focus:bg-background transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="deadline" className="text-sm font-medium flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                {t('tasks.deadline')}
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="deadline"
                                    type="date"
                                    value={deadline}
                                    onChange={(e) => setDeadline(e.target.value)}
                                    className="h-10 border-input bg-background/50 focus:bg-background transition-all"
                                />
                                <Input
                                    id="deadline-time"
                                    type="time"
                                    value={deadlineTime}
                                    onChange={(e) => setDeadlineTime(e.target.value)}
                                    className="h-10 w-[110px] border-input bg-background/50 focus:bg-background transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <Separator className="my-2" />

                {/* 6. Subtasks Section */}
                {mode === 'create' && (
                    <div className="space-y-4 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setIsSubtasksExpanded(!isSubtasksExpanded)}
                            className="w-full justify-between h-12 px-4 hover:bg-muted/50 rounded-xl group"
                        >
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                                    <AlertCircle className="h-4 w-4" />
                                </div>
                                <span className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                                    {t('tasks.subtasks') || 'Subtasks'}
                                </span>
                                {subtasks.length > 0 && (
                                    <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[10px] font-bold">
                                        {subtasks.length}
                                    </Badge>
                                )}
                            </div>
                            <div className="p-1 rounded-full bg-muted group-hover:bg-background transition-colors">
                                {isSubtasksExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                        </Button>

                        {isSubtasksExpanded && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                {/* Compact Subtask Form */}
                                <div className="space-y-3 p-4 bg-muted/20 rounded-2xl border border-dashed border-muted-foreground/20">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="subtask-title" className="text-xs font-medium text-muted-foreground">
                                                {t('tasks.titleLabel')}
                                            </Label>
                                            <Input
                                                id="subtask-title"
                                                placeholder={t('tasks.subtaskTitlePlaceholder') || "What needs to be done?"}
                                                value={newSubtaskTitle}
                                                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                                className="h-9 border-input bg-background/50 focus:bg-background transition-all text-sm"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        handleAddSubtask()
                                                    }
                                                }}
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="subtask-priority" className="text-xs font-medium text-muted-foreground">
                                                {t('tasks.priority')}
                                            </Label>
                                            <Select value={newSubtaskPriority} onValueChange={setNewSubtaskPriority}>
                                                <SelectTrigger id="subtask-priority" className="h-9 text-sm bg-background/50">
                                                    <SelectValue placeholder={t('tasks.priority')} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {['NONE', 'LOW', 'MEDIUM', 'HIGH'].map(p => (
                                                        <SelectItem key={p} value={p}>
                                                            <div className="flex items-center gap-2">
                                                                <div className={cn(
                                                                    "w-1.5 h-1.5 rounded-full",
                                                                    p === 'NONE' ? "bg-muted-foreground/30" :
                                                                        p === 'LOW' ? "bg-emerald-500" :
                                                                            p === 'MEDIUM' ? "bg-amber-500" :
                                                                                "bg-rose-500"
                                                                )} />
                                                                {t(`tasks.priority${p.charAt(0) + p.slice(1).toLowerCase()}` as TranslationKey)}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium text-muted-foreground">{t('tasks.startDate')}</Label>
                                            <div className="flex gap-1.5">
                                                <Input type="date" value={newSubtaskStartDate} onChange={(e) => setNewSubtaskStartDate(e.target.value)} className="h-9 text-xs bg-background/50" />
                                                <Input type="time" value={newSubtaskStartDateTime} onChange={(e) => setNewSubtaskStartDateTime(e.target.value)} className="h-9 w-24 text-xs bg-background/50" />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium text-muted-foreground">{t('tasks.deadline')}</Label>
                                            <div className="flex gap-1.5">
                                                <Input type="date" value={newSubtaskDueDate} onChange={(e) => setNewSubtaskDueDate(e.target.value)} className="h-9 text-xs bg-background/50" />
                                                <Input type="time" value={newSubtaskDueDateTime} onChange={(e) => setNewSubtaskDueDateTime(e.target.value)} className="h-9 w-24 text-xs bg-background/50" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-1">
                                        <Button
                                            type="button"
                                            onClick={handleAddSubtask}
                                            disabled={!newSubtaskTitle.trim()}
                                            size="sm"
                                            className="h-8 px-3 text-xs font-semibold gap-1.5"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            {t('tasks.addSubTask') || 'Add Subtask'}
                                        </Button>
                                    </div>
                                </div>

                                {subtasks.length > 0 && (
                                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                                        {subtasks.map((st) => (
                                            <div
                                                key={st.id}
                                                className="flex items-center gap-3 p-3 bg-background/50 border rounded-xl hover:border-primary/30 transition-all group"
                                            >
                                                <div className={cn(
                                                    "w-1 h-8 rounded-full",
                                                    st.priority === 'HIGH' ? "bg-rose-500" :
                                                        st.priority === 'MEDIUM' ? "bg-amber-500" :
                                                            st.priority === 'LOW' ? "bg-emerald-500" :
                                                                "bg-muted-foreground/30"
                                                )} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{st.title}</p>
                                                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground opacity-70">
                                                        {st.dueDate && (
                                                            <div className="flex items-center gap-1">
                                                                <Calendar className="h-3 w-3" />
                                                                {new Date(st.dueDate).toLocaleDateString()}
                                                            </div>
                                                        )}
                                                        {st.assignedToId && (
                                                            <div className="flex items-center gap-1">
                                                                <UserPlus className="h-3 w-3" />
                                                                {users.find(u => u.id === st.assignedToId)?.name || 'Member'}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteSubtask(st.id)}
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className={cn(
                "flex items-center gap-3 mt-6 pt-6 border-t bg-background/50 backdrop-blur-sm sticky bottom-0 z-10",
                isRTL ? "flex-row-reverse" : "flex-row"
            )}>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onCancel}
                    className="flex-1 h-11 font-semibold text-muted-foreground hover:bg-muted"
                >
                    {t('common.cancel')}
                </Button>
                <Button
                    type="submit"
                    disabled={loading}
                    className="flex-[2] h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 gap-2"
                >
                    {mode === 'edit' ? (
                        <>
                            <Pencil className="h-4 w-4" />
                            {t('tasks.edit')}
                        </>
                    ) : (
                        <>
                            <Plus className="h-5 w-5" />
                            {t('tasks.create')}
                        </>
                    )}
                </Button>
            </div>
        </form>
    )
}
