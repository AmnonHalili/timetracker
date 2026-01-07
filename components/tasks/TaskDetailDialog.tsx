"use client"

import { useState, useEffect, useMemo } from "react"
import React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, Users, MessageSquare, Paperclip, Send, FileText, X, AtSign, Link2, Plus, Info, Calendar, ChevronDown, ChevronUp } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { useLanguage } from "@/lib/useLanguage"
import { toast } from "sonner"
import { format } from "date-fns"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { UnifiedTimeline, UnifiedActivityItem } from "./UnifiedTimeline"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"

// eslint-disable-next-line @typescript-eslint/no-explicit-any


interface TaskDetailDialogProps {
    task: {
        id: string
        title: string
        description: string | null
        status: string
        priority: string
        deadline: Date | string | null
        assignees: Array<{ id: string; name: string | null }>
        watchers?: Array<{ id: string; name: string | null; image?: string | null }>
        labels?: Array<{ id: string; name: string; color: string }>
        blocking?: Array<{ id: string; title: string; status: string }>
        blockedBy?: Array<{ id: string; title: string; status: string }>
        checklist: Array<{ id: string; text: string; isDone: boolean }>
        subtasks?: Array<{
            id: string;
            title: string;
            isDone: boolean;
            priority?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
            assignedToId?: string | null;
            assignedTo?: { id: string; name: string | null; image?: string | null } | null;
            dueDate?: Date | string | null;
        }>
    } | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onUpdate?: (updatedFields?: Partial<NonNullable<TaskDetailDialogProps['task']>>) => void
    timeEntries?: Array<{
        id: string
        startTime: Date | string
        endTime: Date | string | null
        description: string | null
        subtaskId: string | null
        subtask?: {
            id: string
            title: string
        } | null
        user: {
            id: string
            name: string | null
        }
    }>
    projectUsers?: Array<{ id: string; name: string | null; email: string | null }>
    highlightNoteId?: string | null
    labels?: Array<{ id: string; name: string; color: string }>
    allTasks?: Array<{ id: string; title: string; status: string }>

    onSubtaskUpdate?: (taskId: string, subtaskId: string, updates: {
        title?: string;
        priority?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
        assignedToId?: string | null;
        dueDate?: Date | null;
    }) => void

}

interface Note {
    id: string
    content: string
    createdAt: string
    user: {
        id: string
        name: string | null
        image: string | null
    }
}

interface Attachment {
    id: string
    fileName: string
    fileUrl: string
    fileSize: number
    createdAt: string
    user: {
        id: string
        name: string | null
        image?: string | null
    }
}

interface ActivityLog {
    id: string
    action: string
    details: string | null
    createdAt: string
    user: {
        id: string
        name: string | null
        image: string | null
    }
}

export function TaskDetailDialog({
    task,
    open,
    onOpenChange,
    onUpdate,
    timeEntries = [],
    projectUsers = [],
    highlightNoteId = null,
    allTasks = [],
    onSubtaskUpdate
}: TaskDetailDialogProps) {
    const { t } = useLanguage()
    const { data: session } = useSession()
    const currentUserId = session?.user?.id
    const router = useRouter()
    const isMobile = useMediaQuery("(max-width: 768px)")

    // Notes & Files State
    const [activeTab, setActiveTab] = useState("details")
    const [notes, setNotes] = useState<Note[]>([])
    const [attachments, setAttachments] = useState<Attachment[]>([])
    const [activities, setActivities] = useState<ActivityLog[]>([])
    const [isWorkLogOpen, setIsWorkLogOpen] = useState(false)

    const [newNote, setNewNote] = useState("")
    const [editingEnhancedSubtask, setEditingEnhancedSubtask] = useState<{
        subtaskId: string;
        priority?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
        assignedToId?: string | null;
        dueDate?: Date | null;
    } | null>(null)
    const [pendingFiles, setPendingFiles] = useState<File[]>([])
    const [loading, setLoading] = useState(false)
    const [submittingNote, setSubmittingNote] = useState(false)
    const [uploadingFile, setUploadingFile] = useState(false)
    const textareaRef = React.useRef<HTMLTextAreaElement>(null)

    // Mention State
    const [mentionSearch, setMentionSearch] = useState("")
    const [showMentions, setShowMentions] = useState(false)
    const [mentionIndex, setMentionIndex] = useState(0)
    const [cursorPosition, setCursorPosition] = useState(0)


    // Mention Logic
    const filteredMentions = useMemo(() => {
        if (!projectUsers || !task?.assignees || !currentUserId) return []

        const assignedIds = new Set(task.assignees.map(a => a.id))
        const mentionableUsers = projectUsers.filter(u => assignedIds.has(u.id) && u.id !== currentUserId)

        if (mentionableUsers.length === 0) return []
        if (!mentionSearch) return mentionableUsers

        return mentionableUsers.filter(u =>
            u.name?.toLowerCase().includes(mentionSearch.toLowerCase())
        )
    }, [mentionSearch, projectUsers, task?.assignees, currentUserId])

    const handleNoteChange = (val: string, cursorIdx: number) => {
        setNewNote(val)
        setCursorPosition(cursorIdx)

        const beforeCursor = val.slice(0, cursorIdx)
        const lastAt = beforeCursor.lastIndexOf("@")

        if (lastAt !== -1 && (lastAt === 0 || /\s/.test(beforeCursor[lastAt - 1]))) {
            const search = beforeCursor.slice(lastAt + 1)
            if (!/\s/.test(search)) {
                setMentionSearch(search)
                setShowMentions(true)
                setMentionIndex(0)
            } else {
                setShowMentions(false)
            }
        } else {
            setShowMentions(false)
        }
    }

    const insertMention = (userName: string) => {
        const lastAt = newNote.lastIndexOf("@", cursorPosition - 1)
        const beforeAt = newNote.slice(0, lastAt)
        const afterCursor = newNote.slice(cursorPosition)
        const updatedNote = beforeAt + "@" + userName + " " + afterCursor
        setNewNote(updatedNote)
        setShowMentions(false)
        setMentionSearch("")
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showMentions) return

        if (e.key === "ArrowDown") {
            e.preventDefault()
            setMentionIndex(prev => (prev + 1) % filteredMentions.length)
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setMentionIndex(prev => (prev - 1 + filteredMentions.length) % filteredMentions.length)
        } else if (e.key === "Enter" && filteredMentions.length > 0) {
            e.preventDefault()
            insertMention(filteredMentions[mentionIndex].name || "")
        } else if (e.key === "Escape") {
            setShowMentions(false)
        }
    }

    const fetchAllUpdates = useMemo(() => async () => {
        if (!task?.id) return
        setLoading(true)
        try {
            const [notesRes, filesRes, activityRes] = await Promise.all([
                fetch(`/api/tasks/${task.id}/notes`),
                fetch(`/api/tasks/${task.id}/attachments`),
                fetch(`/api/tasks/${task.id}/activity`)
            ])

            if (notesRes.ok) setNotes(await notesRes.json())
            if (filesRes.ok) setAttachments(await filesRes.json())
            if (activityRes.ok) setActivities(await activityRes.json())
        } finally {
            setLoading(false)
        }
    }, [task?.id])

    useEffect(() => {
        if (open && task?.id && activeTab === "chat") {
            fetchAllUpdates()
        }
    }, [open, task?.id, activeTab, fetchAllUpdates])


    // Unified Timeline Logic
    const unifiedTimeline = useMemo(() => {
        const items: UnifiedActivityItem[] = []

        // 1. Add Notes
        notes.forEach(note => {
            items.push({
                id: note.id,
                type: 'note',
                createdAt: note.createdAt,
                user: {
                    id: note.user.id,
                    name: note.user.name,
                    image: note.user.image
                },
                content: note.content
            })
        })

        // 2. Add Files
        attachments.forEach(file => {
            items.push({
                id: file.id,
                type: 'file',
                createdAt: file.createdAt,
                user: {
                    id: file.user.id,
                    name: file.user.name,
                    image: file.user.image || null
                },
                fileName: file.fileName,
                fileUrl: file.fileUrl,
                fileSize: file.fileSize
            })
        })

        // 3. Add Activities (filtering out duplicates)
        activities.forEach(act => {
            // Skip activities that are just logs of notes or files we already have
            if (act.action === "COMMENT_ADDED" || act.action === "FILE_UPLOADED") {
                return
            }
            items.push({
                id: act.id,
                type: 'activity',
                createdAt: act.createdAt,
                user: {
                    id: act.user.id,
                    name: act.user.name,
                    image: act.user.image
                },
                action: act.action,
                details: act.details
            })
        })

        // Sort by createdAt DESC (newest first)
        return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }, [notes, attachments, activities])



    const handleTriggerMention = () => {
        const space = newNote.length > 0 && !newNote.endsWith(" ") ? " " : ""
        const updated = newNote + space + "@"
        setNewNote(updated)
        setShowMentions(true)
        setMentionSearch("")

        // Focus textarea and put cursor at end
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus()
                const len = updated.length
                textareaRef.current.setSelectionRange(len, len)
                setCursorPosition(len)
            }
        }, 0)
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return
        setPendingFiles([...pendingFiles, ...files])
        e.target.value = "" // Reset input
    }

    const removePendingFile = (index: number) => {
        setPendingFiles(pendingFiles.filter((_, i) => i !== index))
    }

    const handleSendMessage = async () => {
        if ((!newNote.trim() && pendingFiles.length === 0) || !task?.id) return
        setSubmittingNote(true)

        try {
            // 1. Upload Files first if any
            const uploadedAttachments: Attachment[] = []
            for (const file of pendingFiles) {
                setUploadingFile(true)
                try {
                    // Get Presigned URL
                    const presignRes = await fetch("/api/upload/presigned", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            fileName: file.name,
                            fileType: file.type,
                            fileSize: file.size,
                            taskId: task.id
                        })
                    })

                    if (!presignRes.ok) throw new Error(`Presign failed for ${file.name}`)
                    const { url, key } = await presignRes.json()

                    // Upload to S3
                    const uploadRes = await fetch(url, {
                        method: "PUT",
                        body: file,
                        headers: { "Content-Type": file.type }
                    })
                    if (!uploadRes.ok) throw new Error(`Upload failed for ${file.name}`)

                    // Save Metadata
                    const saveRes = await fetch(`/api/tasks/${task.id}/attachments`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            fileName: file.name,
                            fileType: file.type,
                            fileSize: file.size,
                            fileKey: key
                        })
                    })
                    if (saveRes.ok) {
                        const attachment = await saveRes.json()
                        uploadedAttachments.push(attachment)
                    }
                } catch (err) {
                    console.error(err)
                    alert(`Failed to upload ${file.name}`)
                } finally {
                    setUploadingFile(false)
                }
            }

            // Update attachments state if any were uploaded
            if (uploadedAttachments.length > 0) {
                setAttachments(prev => [...uploadedAttachments, ...prev])
            }

            // 2. Send Note if text exists
            if (newNote.trim()) {
                const res = await fetch(`/api/tasks/${task.id}/notes`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content: newNote })
                })
                if (res.ok) {
                    const note = await res.json()
                    setNotes(prev => [note, ...prev])
                }
            }

            // Sync with timeline/activity
            if (activeTab === "chat") {
                fetchAllUpdates()
            }

            // 3. Clear state
            setNewNote("")
            setPendingFiles([])

        } catch (error) {
            console.error(error)
            alert("Something went wrong while sending.")
        } finally {
            setSubmittingNote(false)
        }
    }


    const formatTime = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60

        if (hours > 0) {
            return `${hours}h ${minutes}m`
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`
        } else {
            return `${seconds}s`
        }
    }

    // Helper functions for stats
    const calculateTotalTimeValue = () => {
        let totalSeconds = 0
        timeEntries.forEach(entry => {
            if (entry.endTime) {
                const start = new Date(entry.startTime).getTime()
                const end = new Date(entry.endTime).getTime()
                totalSeconds += Math.floor((end - start) / 1000)
            }
        })
        return totalSeconds
    }

    const calculateTotalTime = () => {
        return formatTime(calculateTotalTimeValue())
    }

    // Initialize timeByUser with all assignees (even if they haven't worked yet)
    const timeByUser = new Map<string, { user: { id: string; name: string | null }, totalSeconds: number }>()

    // First, add all assignees with 0 time
    if (task?.assignees) {
        task.assignees.forEach(assignee => {
            timeByUser.set(assignee.id, { user: { id: assignee.id, name: assignee.name }, totalSeconds: 0 })
        })
    }

    // Then, update with actual time entries
    timeEntries.forEach(entry => {
        if (entry.endTime && entry.user) {
            const start = new Date(entry.startTime).getTime()
            const end = new Date(entry.endTime).getTime()
            const seconds = Math.floor((end - start) / 1000)
            const existing = timeByUser.get(entry.user.id)
            if (existing) {
                existing.totalSeconds += seconds
            } else {
                timeByUser.set(entry.user.id, { user: entry.user, totalSeconds: seconds })
            }
        }
    })




    const handleAddDependency = async (type: 'BLOCKING' | 'BLOCKED_BY', targetTaskId: string) => {
        if (!task || !allTasks) return

        const targetTask = allTasks.find(t => t.id === targetTaskId)
        if (!targetTask) return

        const currentBlocking = task.blocking || []
        const currentBlockedBy = task.blockedBy || []
        let updatePayload = {}

        if (type === 'BLOCKING') {
            if (currentBlocking.some(t => t.id === targetTaskId)) return
            const newBlocking = [...currentBlocking, targetTask]
            onUpdate?.({ blocking: newBlocking })
            updatePayload = { blockingIds: newBlocking.map(t => t.id) }
        } else {
            if (currentBlockedBy.some(t => t.id === targetTaskId)) return
            const newBlockedBy = [...currentBlockedBy, targetTask]
            onUpdate?.({ blockedBy: newBlockedBy })
            updatePayload = { blockedByIds: newBlockedBy.map(t => t.id) }
        }

        try {
            const res = await fetch(`/api/tasks/${task.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatePayload)
            })
            if (!res.ok) throw new Error("Failed to update dependencies")
            router.refresh()
        } catch (error) {
            console.error(error)
            toast.error("Failed to add dependency")
        }
    }

    const handleRemoveDependency = async (type: 'BLOCKING' | 'BLOCKED_BY', targetTaskId: string) => {
        if (!task) return

        const currentBlocking = task.blocking || []
        const currentBlockedBy = task.blockedBy || []
        let updatePayload = {}

        if (type === 'BLOCKING') {
            const newBlocking = currentBlocking.filter(t => t.id !== targetTaskId)
            onUpdate?.({ blocking: newBlocking })
            updatePayload = { blockingIds: newBlocking.map(t => t.id) }
        } else {
            const newBlockedBy = currentBlockedBy.filter(t => t.id !== targetTaskId)
            onUpdate?.({ blockedBy: newBlockedBy })
            updatePayload = { blockedByIds: newBlockedBy.map(t => t.id) }
        }

        try {
            const res = await fetch(`/api/tasks/${task.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatePayload)
            })
            if (!res.ok) throw new Error("Failed to remove dependency")
            router.refresh()
        } catch (error) {
            console.error(error)
            toast.error("Failed to remove dependency")
        }
    }

    if (!task) return null

    // Shared content component
    const dialogContent = (
        <>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 md:px-6 border-b shrink-0">
                    <TabsList className="w-full justify-start h-auto bg-transparent p-0 gap-2">
                        <TabsTrigger
                            value="details"
                            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4 py-2 focus-visible:ring-0 focus-visible:outline-none focus:ring-0 focus:outline-none"
                        >
                            {t('tasks.details') || "Details"}
                        </TabsTrigger>
                        <TabsTrigger
                            value="chat"
                            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-4 py-2 flex gap-2 items-center focus-visible:ring-0 focus-visible:outline-none focus:ring-0 focus:outline-none"
                        >
                            <MessageSquare className="h-4 w-4" />
                            Updated & Chat
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="flex-1 overflow-hidden relative">
                    <TabsContent value="details" className="mt-0 h-full">
                        <ScrollArea className="h-full">
                            <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                                {/* Quick Summary Stats */}
                                {(() => {
                                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                    const calculation = calculateTotalTimeValue()
                                    // totalTime removed or commented out as it was unused and referenced calculation only for side effects if any (probably pure calc though)
                                    // Actually calculateTotalTimeValue is just a calculation. If unused, remove.

                                    const peopleWorked = Array.from(timeByUser.values()).filter(u => u.totalSeconds > 0).length

                                    // Find last activity date from time entries or activities
                                    let lastActivityDate: Date | null = null
                                    if (timeEntries && timeEntries.length > 0) {
                                        const completedEntries = timeEntries.filter(e => e.endTime)
                                        if (completedEntries.length > 0) {
                                            const dates = completedEntries.map(e => new Date(e.startTime))
                                            lastActivityDate = new Date(Math.max(...dates.map(d => d.getTime())))
                                        }
                                    }
                                    if (activities && activities.length > 0) {
                                        const activityDates = activities.map(a => new Date(a.createdAt))
                                        const latestActivity = new Date(Math.max(...activityDates.map(d => d.getTime())))
                                        if (!lastActivityDate || latestActivity > lastActivityDate) {
                                            lastActivityDate = latestActivity
                                        }
                                    }

                                    return (
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="bg-card rounded-lg border border-border/50 p-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-xs font-medium text-muted-foreground">Total Time</span>
                                                </div>
                                                <div className="text-lg font-bold text-primary">
                                                    {calculateTotalTime()}
                                                </div>
                                            </div>

                                            <div className="bg-card rounded-lg border border-border/50 p-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Users className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-xs font-medium text-muted-foreground">People Worked</span>
                                                </div>
                                                <div className="text-lg font-bold text-primary">
                                                    {peopleWorked || 0}
                                                </div>
                                            </div>

                                            <div className="bg-card rounded-lg border border-border/50 p-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-xs font-medium text-muted-foreground">Last Activity</span>
                                                </div>
                                                <div className="text-sm font-semibold text-foreground">
                                                    {lastActivityDate
                                                        ? new Date(lastActivityDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                        : 'No activity'}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })()}

                                {/* Description */}
                                {task.description && (
                                    <div className="bg-card rounded-lg border border-border/50 p-4">
                                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            {t('tasks.description') || "Description"}
                                        </h3>
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{task.description}</p>
                                    </div>
                                )}


                                {/* Team Activity - Summary with total time and individual contributions */}
                                {task?.assignees && task.assignees.length > 0 && (() => {
                                    const totalTime = calculateTotalTimeValue()
                                    const hasWorked = totalTime > 0
                                    // Sort users by time worked (most to least)
                                    const usersWithTime = Array.from(timeByUser.values())
                                        .filter(u => u.totalSeconds > 0)
                                        .sort((a, b) => b.totalSeconds - a.totalSeconds)

                                    return (
                                        <div className="space-y-3">
                                            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                                                <Users className="h-4 w-4" />
                                                {t('tasks.teamActivity') || "Team Activity"}
                                            </h3>

                                            <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
                                                {/* Individual Contributors - Sorted from most to least */}
                                                {hasWorked && usersWithTime.length > 0 ? (
                                                    <div className="divide-y divide-border/50">
                                                        {usersWithTime.map(({ user, totalSeconds }, index) => (
                                                            <div key={user.id} className="flex justify-between items-center p-3 hover:bg-muted/30 transition-colors group">
                                                                <div className="flex items-center gap-2.5 flex-1">
                                                                    <div className="relative">
                                                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary ring-2 ring-background group-hover:ring-primary/30 transition-all">
                                                                            {user.name?.substring(0, 2).toUpperCase() || "??"}
                                                                        </div>
                                                                        {index === 0 && usersWithTime.length > 1 && (
                                                                            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                                                                                <span className="text-[9px] font-bold text-primary-foreground">1</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <span className="text-xs font-medium block truncate">{user.name || 'Unknown'}</span>
                                                                        <span className="text-[10px] text-muted-foreground">
                                                                            {index === 0 ? "Most time worked" : `${index + 1}${index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'} contributor`}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-xs font-bold font-mono text-primary min-w-[70px] text-right">
                                                                        {formatTime(totalSeconds)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-3 text-center text-xs text-muted-foreground">
                                                        No work logged yet
                                                    </div>
                                                )}

                                                {/* Total Time Spent - Summary at bottom */}
                                                <div className="p-3 bg-muted/30 border-t border-border/50">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                                            <Clock className="h-3.5 w-3.5" />
                                                            {t('tasks.totalTimeSpent') || "Total Time Spent"}
                                                        </span>
                                                        <span className="text-sm font-bold font-mono text-primary">
                                                            {calculateTotalTime()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })()}

                                {/* Work Log - Detailed time entries (Collapsible) */}
                                {timeEntries && timeEntries.length > 0 && (() => {
                                    const completedEntries = timeEntries.filter(entry => entry.endTime)

                                    if (completedEntries.length === 0) return null

                                    // Separate main task entries from subtask entries
                                    const mainTaskEntries = completedEntries.filter(entry => !entry.subtask)
                                    const subtaskEntries = completedEntries.filter(entry => entry.subtask)

                                    // Sort main task entries by time (most time first)
                                    const sortedMainTaskEntries = mainTaskEntries.sort((a, b) => {
                                        const startA = new Date(a.startTime).getTime()
                                        const endA = new Date(a.endTime!).getTime()
                                        const secondsA = Math.floor((endA - startA) / 1000)

                                        const startB = new Date(b.startTime).getTime()
                                        const endB = new Date(b.endTime!).getTime()
                                        const secondsB = Math.floor((endB - startB) / 1000)

                                        return secondsB - secondsA // Most time first
                                    })

                                    // Get subtask order from task.subtasks (already sorted by createdAt: 'asc' from API)
                                    const subtaskOrder = task?.subtasks ? task.subtasks.map(s => s.id) : []

                                    // Group subtask entries by subtask ID
                                    const entriesBySubtask = new Map<string, typeof subtaskEntries>()
                                    const subtaskTitles = new Map<string, string>()
                                    subtaskEntries.forEach(entry => {
                                        if (entry.subtask) {
                                            const subtaskId = entry.subtask.id
                                            if (!entriesBySubtask.has(subtaskId)) {
                                                entriesBySubtask.set(subtaskId, [])
                                            }
                                            entriesBySubtask.get(subtaskId)!.push(entry)
                                            subtaskTitles.set(subtaskId, entry.subtask.title)
                                        }
                                    })

                                    // Sort entries within each subtask by time (most time first)
                                    entriesBySubtask.forEach((entries) => {
                                        entries.sort((a, b) => {
                                            const startA = new Date(a.startTime).getTime()
                                            const endA = new Date(a.endTime!).getTime()
                                            const secondsA = Math.floor((endA - startA) / 1000)

                                            const startB = new Date(b.startTime).getTime()
                                            const endB = new Date(b.endTime!).getTime()
                                            const secondsB = Math.floor((endB - startB) / 1000)

                                            return secondsB - secondsA // Most time first
                                        })
                                    })

                                    // Get all subtask IDs from entries (including deleted subtasks)
                                    const allSubtaskIds = Array.from(entriesBySubtask.keys())

                                    // Separate known subtasks (in order) from unknown ones (deleted)
                                    const knownSubtaskIds = subtaskOrder.filter(id => entriesBySubtask.has(id))
                                    const unknownSubtaskIds = allSubtaskIds.filter(id => !subtaskOrder.includes(id))

                                    // Build final sorted list: main task first, then subtasks in order
                                    const sortedEntries: typeof completedEntries = []

                                    // Add main task entries first (if any)
                                    sortedEntries.push(...sortedMainTaskEntries)

                                    // Add known subtask entries in order (from task.subtasks)
                                    knownSubtaskIds.forEach(subtaskId => {
                                        const entries = entriesBySubtask.get(subtaskId)
                                        if (entries) {
                                            sortedEntries.push(...entries)
                                        }
                                    })

                                    // Add unknown subtask entries at the end (deleted subtasks)
                                    unknownSubtaskIds.forEach(subtaskId => {
                                        const entries = entriesBySubtask.get(subtaskId)
                                        if (entries) {
                                            sortedEntries.push(...entries)
                                        }
                                    })

                                    return (
                                        <div className="space-y-3">
                                            <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
                                                <button
                                                    onClick={() => setIsWorkLogOpen(!isWorkLogOpen)}
                                                    className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                                        <h3 className="text-sm font-semibold text-foreground">
                                                            {t('tasks.workLog') || "Work Log"}
                                                        </h3>
                                                        <Badge variant="secondary" className="text-xs h-5 px-1.5">
                                                            {completedEntries.length}
                                                        </Badge>
                                                    </div>
                                                    {isWorkLogOpen ? (
                                                        <ChevronUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                                    )}
                                                </button>

                                                {isWorkLogOpen && (
                                                    <div className="border-t border-border/50 divide-y divide-border/50">
                                                        {sortedEntries.map((entry) => {
                                                            const start = new Date(entry.startTime).getTime()
                                                            const end = new Date(entry.endTime!).getTime()
                                                            const seconds = Math.floor((end - start) / 1000)
                                                            const workTarget = entry.subtask ? entry.subtask.title : task?.title || "Main Task"

                                                            return (
                                                                <div key={entry.id} className="p-3 hover:bg-muted/30 transition-colors">
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                                                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">
                                                                                {entry.user.name?.substring(0, 2).toUpperCase() || "??"}
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="text-xs font-semibold truncate">{entry.user.name || 'Unknown'}</div>
                                                                                <div className="text-xs text-muted-foreground truncate mt-0.5">
                                                                                    {workTarget}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex-shrink-0">
                                                                            <span className="text-xs font-bold font-mono text-primary">
                                                                                {formatTime(seconds)}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })()}

                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                                        <Link2 className="h-4 w-4" />
                                        Dependencies
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                                </TooltipTrigger>
                                                <TooltipContent className="max-w-xs p-4 bg-popover border-border shadow-xl">
                                                    <div className="space-y-3">
                                                        <h4 className="font-semibold text-sm">Task Dependencies</h4>
                                                        <div className="space-y-2 text-xs text-muted-foreground">
                                                            <p>Reference tasks that are related to this one&apos;s progress:</p>
                                                            <ul className="list-disc pl-4 space-y-1">
                                                                <li>
                                                                    <span className="font-medium text-foreground">Blocked By:</span> Tasks that must be completed <em>before</em> this task can start.
                                                                </li>
                                                                <li>
                                                                    <span className="font-medium text-foreground">Blocking:</span> Tasks that cannot start <em>until</em> this task is finished.
                                                                </li>
                                                                <li>
                                                                    <span className="font-medium text-foreground">Note:</span> One&apos;s output is another&apos;s input.
                                                                </li>
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Blocked By */}
                                        <div className="border rounded-md p-3 space-y-2">
                                            <div className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
                                                Blocked By
                                                {task.blockedBy && task.blockedBy.length > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px]">{task.blockedBy.length}</Badge>}
                                            </div>
                                            <div className="space-y-1">
                                                {task.blockedBy?.map(t => (
                                                    <div key={t.id} className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded group">
                                                        <span className="truncate flex-1 mr-2">{t.title}</span>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemoveDependency('BLOCKED_BY', t.id)}>
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" size="sm" className="w-full text-xs dashed h-7">
                                                        <Plus className="w-3 h-3 mr-1" /> Add
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="p-0" align="start">
                                                    <Command>
                                                        <CommandInput placeholder="Search task..." />
                                                        <CommandList>
                                                            <CommandEmpty>No task found.</CommandEmpty>
                                                            <CommandGroup>
                                                                {allTasks?.filter(t => t.id !== task.id && !task.blockedBy?.some(dep => dep.id === t.id)).map(t => (
                                                                    <CommandItem key={t.id} onSelect={() => handleAddDependency('BLOCKED_BY', t.id)}>
                                                                        <span>{t.title}</span>
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>

                                        {/* Blocking */}
                                        <div className="border rounded-md p-3 space-y-2">
                                            <div className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
                                                Blocking
                                                {task.blocking && task.blocking.length > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px]">{task.blocking.length}</Badge>}
                                            </div>
                                            <div className="space-y-1">
                                                {task.blocking?.map(t => (
                                                    <div key={t.id} className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded group">
                                                        <span className="truncate flex-1 mr-2">{t.title}</span>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemoveDependency('BLOCKING', t.id)}>
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" size="sm" className="w-full text-xs dashed h-7">
                                                        <Plus className="w-3 h-3 mr-1" /> Add
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="p-0" align="start">
                                                    <Command>
                                                        <CommandInput placeholder="Search task..." />
                                                        <CommandList>
                                                            <CommandEmpty>No task found.</CommandEmpty>
                                                            <CommandGroup>
                                                                {allTasks?.filter(t => t.id !== task.id && !task.blocking?.some(dep => dep.id === t.id)).map(t => (
                                                                    <CommandItem key={t.id} onSelect={() => handleAddDependency('BLOCKING', t.id)}>
                                                                        <span>{t.title}</span>
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="chat" className="mt-0 h-full flex flex-col">
                        {loading ? (
                            <div className="p-4 md:p-6 space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                                    <div className="space-y-2 flex-1">
                                        <div className="h-4 w-1/4 bg-muted animate-pulse rounded" />
                                        <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                                    <div className="space-y-2 flex-1">
                                        <div className="h-4 w-1/4 bg-muted animate-pulse rounded" />
                                        <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                                    <div className="space-y-2 flex-1">
                                        <div className="h-4 w-1/3 bg-muted animate-pulse rounded" />
                                        <div className="h-4 w-full bg-muted animate-pulse rounded" />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-hidden p-4 md:p-6 pb-2">
                                <UnifiedTimeline
                                    taskId={task.id}
                                    items={unifiedTimeline}
                                    isLoading={loading}
                                    currentUserId={currentUserId}
                                    onUpdate={fetchAllUpdates}
                                    highlightNoteId={highlightNoteId}
                                />
                            </div>
                        )}

                        {/* Unified Composer */}
                        <div className="border-t bg-background p-4 z-10 shrink-0">
                            <div className="space-y-4">
                                {/* Pending Files Preview */}
                                {pendingFiles.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pb-2">
                                        {pendingFiles.map((file, idx) => (
                                            <div key={idx} className="flex items-center gap-2 bg-muted/50 px-2 py-1 rounded border text-xs group">
                                                <FileText className="h-3 w-3 text-blue-500" />
                                                <span className="max-w-[150px] truncate">{file.name}</span>
                                                <button
                                                    onClick={() => removePendingFile(idx)}
                                                    className="p-0.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors ml-1"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="relative">
                                    <Textarea
                                        ref={textareaRef}
                                        placeholder="Type a message..."
                                        value={newNote}
                                        onChange={(e) => handleNoteChange(e.target.value, e.target.selectionStart)}
                                        onKeyDown={handleKeyDown}
                                        className="min-h-[80px]"
                                    />

                                    {/* Mention Suggestions */}
                                    {showMentions && filteredMentions.length > 0 && (
                                        <div className="absolute bottom-full left-0 mb-2 w-64 bg-popover border rounded-lg shadow-xl z-50 overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
                                            <div className="p-2 border-b bg-muted/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex justify-between items-center">
                                                <span>{t('tasks.mentionUser')}</span>
                                                <span className="text-[9px] flex gap-2">
                                                    <span>↑↓ to navigate</span>
                                                    <span>↵ to select</span>
                                                </span>
                                            </div>
                                            <div className="max-h-48 overflow-y-auto">
                                                {filteredMentions.map((u, i) => (
                                                    <div
                                                        key={u.id}
                                                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${i === mentionIndex ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                                                        onClick={() => insertMention(u.name || "")}
                                                    >
                                                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold">
                                                            {u.name?.substring(0, 2).toUpperCase() || "??"}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-sm font-medium truncate">{u.name}</span>
                                                            <span className={`text-[10px] truncate ${i === mentionIndex ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{u.email}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-between items-center">
                                    {/* File Upload Button */}
                                    <div className="flex items-center">
                                        <input
                                            type="file"
                                            id="chat-file-upload"
                                            className="hidden"
                                            multiple
                                            onChange={handleFileUpload}
                                            disabled={submittingNote}
                                        />
                                        <label htmlFor="chat-file-upload" className={`cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9 ${submittingNote ? "opacity-50 cursor-not-allowed" : ""}`}>
                                            <Paperclip className="h-4 w-4" />
                                        </label>
                                        {uploadingFile && <span className="text-xs text-muted-foreground ml-2">Uploading...</span>}
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200"
                                                        onClick={handleTriggerMention}
                                                        disabled={submittingNote}
                                                    >
                                                        <AtSign className="h-4 w-4" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{t('tasks.mentionSomeone')}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <Button
                                            onClick={handleSendMessage}
                                            disabled={submittingNote || (!newNote.trim() && pendingFiles.length === 0)}
                                            size="sm"
                                            className="bg-primary hover:bg-primary/90 shadow-md transition-all duration-200"
                                        >
                                            {submittingNote ? "Sending..." : "Send"}
                                            <Send className="ml-2 h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </div>
            </Tabs>

            {/* Subtask Detail Edit Dialog */}
            {editingEnhancedSubtask && (
                <Dialog open={true} onOpenChange={() => setEditingEnhancedSubtask(null)}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>{t('tasks.editSubtaskDetails') || "Edit Subtask Details"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            {/* Priority Selector */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Info className="h-4 w-4" />
                                    {t('tasks.subtaskPriority') || "Priority"}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {['LOW', 'MEDIUM', 'HIGH'].map((p) => (
                                        <Button
                                            key={p}
                                            variant={editingEnhancedSubtask.priority === p ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setEditingEnhancedSubtask(prev => prev ? { ...prev, priority: p as 'LOW' | 'MEDIUM' | 'HIGH' } : null)}
                                            className={cn(
                                                "flex-1",
                                                editingEnhancedSubtask.priority === p && p === 'HIGH' && "bg-red-600 hover:bg-red-700",
                                                editingEnhancedSubtask.priority === p && p === 'MEDIUM' && "bg-yellow-600 hover:bg-yellow-700",
                                                editingEnhancedSubtask.priority === p && p === 'LOW' && "bg-blue-600 hover:bg-blue-700"
                                            )}
                                        >
                                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                            {t(`tasks.priority${p.charAt(0) + p.slice(1).toLowerCase()}` as any) || p}
                                        </Button>
                                    ))}
                                    <Button
                                        variant={!editingEnhancedSubtask.priority ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setEditingEnhancedSubtask(prev => prev ? { ...prev, priority: null } : null)}
                                        className="flex-1"
                                    >
                                        {t('tasks.subtaskNoPriority') || "None"}
                                    </Button>
                                </div>
                            </div>

                            {/* Assignee Selector */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    {t('tasks.subtaskAssignedTo') || "Assigned To"}
                                </label>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="w-full justify-between">
                                            {editingEnhancedSubtask.assignedToId ? (
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-5 w-5">
                                                        <AvatarFallback className="text-[8px]">
                                                            {task?.assignees.find(u => u.id === editingEnhancedSubtask.assignedToId)?.name?.substring(0, 2).toUpperCase() || "??"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    {task?.assignees.find(u => u.id === editingEnhancedSubtask.assignedToId)?.name}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">{t('tasks.subtaskNoAssignee') || "Unassigned"}</span>
                                            )}
                                            <ChevronDown className="h-4 w-4 opacity-50" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-[300px]">
                                        <DropdownMenuItem onClick={() => setEditingEnhancedSubtask(prev => prev ? { ...prev, assignedToId: null } : null)}>
                                            {t('tasks.subtaskNoAssignee') || "Unassigned"}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        {task?.assignees.map(user => (
                                            <DropdownMenuItem
                                                key={user.id}
                                                onClick={() => setEditingEnhancedSubtask(prev => prev ? { ...prev, assignedToId: user.id } : null)}
                                                className="flex items-center gap-2"
                                            >
                                                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                                    {user.name?.substring(0, 2).toUpperCase() || "??"}
                                                </div>
                                                {user.name}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* Due Date Picker */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    {t('tasks.subtaskDueDate') || "Due Date"}
                                </label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !editingEnhancedSubtask.dueDate && "text-muted-foreground"
                                            )}
                                        >
                                            <Calendar className="mr-2 h-4 w-4" />
                                            {editingEnhancedSubtask.dueDate ? format(new Date(editingEnhancedSubtask.dueDate), "PPP") : <span>{t('tasks.pickDate') || "Pick a date"}</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <CalendarComponent
                                            mode="single"
                                            selected={editingEnhancedSubtask.dueDate ? new Date(editingEnhancedSubtask.dueDate) : undefined}
                                            onSelect={(date) => setEditingEnhancedSubtask(prev => prev ? { ...prev, dueDate: date || null } : null)}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-4">
                                <Button variant="outline" className="flex-1" onClick={() => setEditingEnhancedSubtask(null)}>
                                    {t('common.cancel') || "Cancel"}
                                </Button>
                                <Button className="flex-1" onClick={() => {
                                    if (task && editingEnhancedSubtask) {
                                        onSubtaskUpdate?.(task.id, editingEnhancedSubtask.subtaskId, {
                                            priority: editingEnhancedSubtask.priority,
                                            assignedToId: editingEnhancedSubtask.assignedToId,
                                            dueDate: editingEnhancedSubtask.dueDate
                                        })
                                        setEditingEnhancedSubtask(null)
                                    }
                                }}>
                                    {t('common.save') || "Save"}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    )

    // Mobile: Use Sheet
    if (isMobile) {
        return (
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent side="bottom" className="h-[95vh] rounded-t-3xl px-4 pb-0 pt-6 flex flex-col gap-0">
                    <SheetHeader className="pb-2">
                        <SheetTitle className="text-xl font-semibold truncate">{task.title}</SheetTitle>
                        {task.labels && task.labels.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {task.labels.map(label => (
                                    <Badge key={label.id} variant="outline" className="px-1 py-0 text-[10px] h-4 font-normal" style={{ borderColor: label.color, color: label.color }}>
                                        {label.name}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </SheetHeader>
                    {dialogContent}
                </SheetContent>
            </Sheet>
        )
    }

    // Desktop: Use Dialog
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl h-[600px] max-h-[90vh] flex flex-col p-0 gap-0 data-[state=open]:animate-in data-[state=closed]:animate-out fade-in-0 zoom-in-95 slide-in-from-bottom-[48%] duration-200">
                <DialogHeader className="p-6 pb-2 flex flex-row items-center justify-between space-y-0">
                    <div className="flex flex-col gap-1 pr-4 truncate flex-1">
                        <DialogTitle className="text-2xl truncate">{task.title}</DialogTitle>
                        {task.labels && task.labels.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {task.labels.map(label => (
                                    <Badge key={label.id} variant="outline" className="px-1 py-0 text-[10px] h-4 font-normal" style={{ borderColor: label.color, color: label.color }}>
                                        {label.name}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogHeader>
                {dialogContent}
            </DialogContent>
        </Dialog>
    )
}
