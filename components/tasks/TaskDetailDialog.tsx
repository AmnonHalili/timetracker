"use client"

import { useState, useEffect, useMemo } from "react"
import React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Clock, Users, CheckCircle2, MessageSquare, Paperclip, Send } from "lucide-react"
import { useLanguage } from "@/lib/useLanguage"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
// import { useSession } from "next-auth/react"
import { UnifiedTimeline, UnifiedActivityItem } from "./UnifiedTimeline"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
}

interface Note {
    id: string
    content: string
    createdAt: string
    user: {
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
        name: string | null
    }
}

interface ActivityLog {
    id: string
    action: string
    details: string | null
    createdAt: string
    user: {
        name: string | null
        image: string | null
    }
}

export function TaskDetailDialog({ task, open, onOpenChange, onUpdate, timeEntries = [] }: TaskDetailDialogProps) {
    const { t } = useLanguage()
    // const { data: session } = useSession()

    // Notes & Files State
    const [activeTab, setActiveTab] = useState("details")
    const [notes, setNotes] = useState<Note[]>([])
    const [attachments, setAttachments] = useState<Attachment[]>([])
    const [activities, setActivities] = useState<ActivityLog[]>([])

    const [newNote, setNewNote] = useState("")
    const [loading, setLoading] = useState(false)
    const [submittingNote, setSubmittingNote] = useState(false)
    const [uploadingFile, setUploadingFile] = useState(false)

    // Local state for status (synced with task prop initially, updated on change)
    const [status, setStatus] = useState(task?.status || "TODO")

    useEffect(() => {
        if (task?.status) {
            setStatus(task.status)
        }
    }, [task?.status])

    const fetchAllUpdates = React.useCallback(async () => {
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
                user: note.user,
                content: note.content
            })
        })

        // 2. Add Files
        attachments.forEach(file => {
            items.push({
                id: file.id,
                type: 'file',
                createdAt: file.createdAt,
                user: { name: file.user.name, image: null }, // Attachments user might lack image in current API
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
                user: act.user,
                action: act.action,
                details: act.details
            })
        })

        // Sort by createdAt DESC (newest first)
        return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }, [notes, attachments, activities])


    const handleAddNote = async () => {
        if (!newNote.trim() || !task?.id) return
        setSubmittingNote(true)
        try {
            const res = await fetch(`/api/tasks/${task.id}/notes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: newNote })
            })
            if (res.ok) {
                const note = await res.json()
                setNotes([note, ...notes])
                setNewNote("")
            }
        } finally {
            setSubmittingNote(false)
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !task?.id) return

        setUploadingFile(true)
        try {
            // 1. Get Presigned URL
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

            if (!presignRes.ok) {
                const error = await presignRes.json()
                alert(error.message || "Upload failed")
                return
            }

            const { url, key } = await presignRes.json()

            // 2. Upload to S3
            const uploadRes = await fetch(url, {
                method: "PUT",
                body: file,
                headers: { "Content-Type": file.type }
            })

            if (!uploadRes.ok) {
                throw new Error("Failed to upload to storage")
            }

            // 3. Save Metadata
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
                setAttachments([attachment, ...attachments])
            }

        } catch (error) {
            console.error(error)
            alert("Upload failed. Please try again.")
        } finally {
            setUploadingFile(false)
            e.target.value = "" // Reset input
        }
    }

    const handleStatusChange = async (newStatus: string) => {
        if (!task?.id) return
        setStatus(newStatus) // Optimistic update
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
            <DialogContent className="max-w-2xl h-[600px] max-h-[90vh] flex flex-col p-0 gap-0">
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
                            <div className="flex-1 overflow-hidden p-6 pb-2">
                                <UnifiedTimeline items={unifiedTimeline} isLoading={loading} />
                            </div>

                            {/* Unified Composer */}
                            <div className="border-t bg-background p-4 z-10 shrink-0">
                                <div className="space-y-4">
                                    <Textarea
                                        placeholder="Type a message..."
                                        value={newNote}
                                        onChange={(e) => setNewNote(e.target.value)}
                                        className="min-h-[80px]"
                                    />
                                    <div className="flex justify-between items-center">
                                        {/* File Upload Button */}
                                        <div className="flex items-center">
                                            <input
                                                type="file"
                                                id="chat-file-upload"
                                                className="hidden"
                                                onChange={handleFileUpload}
                                                disabled={uploadingFile}
                                            />
                                            <label htmlFor="chat-file-upload" className={`cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 w-9 ${uploadingFile ? "opacity-50" : ""}`}>
                                                <Paperclip className="h-4 w-4" />
                                            </label>
                                            {uploadingFile && <span className="text-xs text-muted-foreground ml-2">Uploading...</span>}
                                        </div>

                                        <Button onClick={handleAddNote} disabled={submittingNote || !newNote.trim()} size="sm">
                                            {submittingNote ? "Sending..." : "Send"}
                                            <Send className="ml-2 h-3 w-3" />
                                        </Button>
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
