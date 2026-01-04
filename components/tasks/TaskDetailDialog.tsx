"use client"

import { useState, useEffect, useMemo } from "react"
import React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Clock, Users, CheckCircle2, MessageSquare, Paperclip, Send, FileText, X, AtSign } from "lucide-react"
import { useLanguage } from "@/lib/useLanguage"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSession } from "next-auth/react"
import { UnifiedTimeline, UnifiedActivityItem } from "./UnifiedTimeline"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import confetti from "canvas-confetti"

interface TaskDetailDialogProps {
    task: {
        id: string
        title: string
        description: string | null
        status: string
        priority: string
        deadline: Date | string | null
        assignees: Array<{ id: string; name: string | null }>
        checklist: Array<{ id: string; text: string; isDone: boolean }>
        subtasks?: Array<{ id: string; title: string; isDone: boolean }>
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

export function TaskDetailDialog({ task, open, onOpenChange, onUpdate, timeEntries = [], projectUsers = [], highlightNoteId = null }: TaskDetailDialogProps) {
    const { t } = useLanguage()
    const { data: session } = useSession()
    const currentUserId = session?.user?.id

    // Notes & Files State
    const [activeTab, setActiveTab] = useState("details")
    const [notes, setNotes] = useState<Note[]>([])
    const [attachments, setAttachments] = useState<Attachment[]>([])
    const [activities, setActivities] = useState<ActivityLog[]>([])

    const [newNote, setNewNote] = useState("")
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

    // Local state for status (synced with task prop initially, updated on change)
    const [status, setStatus] = useState(task?.status || "TODO")

    useEffect(() => {
        if (task?.status) {
            setStatus(task.status)
        }
    }, [task?.status])

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

    const handleStatusChange = async (newStatus: string) => {
        if (!task?.id) return
        setStatus(newStatus) // Optimistic update
        if (newStatus === 'DONE') {
            confetti({
                particleCount: 150,
                spread: 60,
                origin: { y: 0.6 }
            })
        }

        try {
            const res = await fetch(`/api/tasks/${task.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            })
            if (!res.ok) {
                throw new Error("Failed to update status")
            }
            onUpdate?.({ status: newStatus }) // Notify parent to refresh list with new data
            if (activeTab === "chat") {
                fetchAllUpdates()
            }
        } catch (error) {
            console.error(error)
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

    const usersWhoWorked = Array.from(
        new Map(
            timeEntries
                .filter(entry => entry.user)
                .map(entry => [entry.user.id, entry.user])
        ).values()
    )

    const subtasksDone = task?.subtasks?.filter(s => s.isDone).length || 0
    const totalSubtasks = task?.subtasks?.length || 0
    const completionPercentage = totalSubtasks > 0
        ? Math.round((subtasksDone / totalSubtasks) * 100)
        : task?.status === 'DONE' ? 100 : 0

    const timeByUser = new Map<string, { user: { id: string; name: string | null }, totalSeconds: number }>()
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

    if (!task) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl h-[600px] max-h-[90vh] flex flex-col p-0 gap-0 data-[state=open]:animate-in data-[state=closed]:animate-out fade-in-0 zoom-in-95 slide-in-from-bottom-[48%] duration-200">
                <DialogHeader className="p-6 pb-2 flex flex-row items-center justify-between space-y-0">
                    <DialogTitle className="text-2xl truncate pr-4">{task.title}</DialogTitle>
                    <div className="shrink-0 mr-8">
                        <Select value={status} onValueChange={handleStatusChange}>
                            <SelectTrigger className="w-[140px] h-8">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="TODO">To Do (Open)</SelectItem>
                                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                <SelectItem value="DONE">Done</SelectItem>
                                <SelectItem value="BLOCKED">Blocked</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 border-b shrink-0">
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
                                <div className="p-6 space-y-6">
                                    {/* Description */}
                                    {task.description && (
                                        <div>
                                            <h3 className="text-sm font-semibold mb-2">{t('tasks.description')}</h3>
                                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
                                        </div>
                                    )}

                                    {/* Completion Percentage */}
                                    {totalSubtasks > 0 && (
                                        <div>
                                            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                                <CheckCircle2 className="h-4 w-4" />
                                                Completion: {completionPercentage}%
                                            </h3>
                                            <div className="w-full bg-muted rounded-full h-2.5">
                                                <div
                                                    className="bg-primary h-2.5 rounded-full transition-all"
                                                    style={{ width: `${completionPercentage}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {subtasksDone} of {totalSubtasks} subtasks completed
                                            </p>
                                        </div>
                                    )}

                                    {/* Users Who Worked on This Task */}
                                    {usersWhoWorked.length > 0 && (
                                        <div className="space-y-3">
                                            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
                                                <Users className="h-4 w-4" />
                                                {t('tasks.teamActivity') || "Team Activity"}
                                            </h3>

                                            <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
                                                <div className="divide-y divide-border/50">
                                                    {Array.from(timeByUser.values())
                                                        .sort((a, b) => b.totalSeconds - a.totalSeconds)
                                                        .map(({ user, totalSeconds }) => (
                                                            <div key={user.id} className="flex justify-between items-center p-3 hover:bg-muted/30 transition-colors group">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary ring-2 ring-background group-hover:ring-muted transition-all">
                                                                        {user.name?.substring(0, 2).toUpperCase() || "??"}
                                                                    </div>
                                                                    <span className="text-sm font-medium">{user.name || 'Unknown'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-16 md:w-24 bg-muted/50 rounded-full h-1.5 overflow-hidden hidden sm:block">
                                                                        <div
                                                                            className="bg-primary h-full rounded-full"
                                                                            style={{ width: `${Math.min(100, (totalSeconds / calculateTotalTimeValue()) * 100)}%` }}
                                                                        />
                                                                    </div>
                                                                    <span className="text-sm font-semibold font-mono w-16 text-right">{formatTime(totalSeconds)}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>

                                                <div className="p-4 bg-muted/30 border-t border-border/50 flex items-center justify-between">
                                                    <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                        <Clock className="h-4 w-4" />
                                                        {t('tasks.totalTimeSpent') || "Total Time Spent"}
                                                    </span>
                                                    <span className="text-xl font-bold font-mono tracking-tight text-primary">
                                                        {calculateTotalTime()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="chat" className="mt-0 h-full flex flex-col">
                            {loading ? (
                                <div className="p-6 space-y-4">
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
                                <div className="flex-1 overflow-hidden p-6 pb-2">
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
            </DialogContent>
        </Dialog>
    )
}
