import React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from "date-fns"
import { Activity, FileText, Download, MessageSquare, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

export type UnifiedActivityItem = {
    id: string
    type: 'activity' | 'note' | 'file'
    createdAt: string
    user: {
        id: string
        name: string | null
        image: string | null
    }
    // Activity specific
    action?: string
    details?: string | null
    // Note specific
    content?: string
    // File specific
    fileName?: string
    fileUrl?: string
    fileSize?: number
}

interface UnifiedTimelineProps {
    taskId: string
    items: UnifiedActivityItem[]
    isLoading: boolean
    currentUserId?: string
    onUpdate?: () => void
    highlightNoteId?: string | null
}

type GroupedItem = {
    id: string
    type: 'activity' | 'message'
    createdAt: string
    user: {
        id: string
        name: string | null
        image: string | null
    }
    // For 'message' type
    content?: string
    files?: Array<{
        id: string
        fileName: string
        fileUrl: string
        fileSize: number
    }>
    // For 'activity' type
    action?: string
    details?: string | null
}

export function UnifiedTimeline({ taskId, items, isLoading, currentUserId, onUpdate, highlightNoteId }: UnifiedTimelineProps) {
    const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null)
    const [editContent, setEditContent] = React.useState("")
    const [isUpdating, setIsUpdating] = React.useState(false)

    // Scroll to highlight
    React.useEffect(() => {
        if (highlightNoteId && items.length > 0) {
            const timer = setTimeout(() => {
                const element = document.getElementById(`note-${highlightNoteId}`)
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    element.classList.add('ring-2', 'ring-primary', 'bg-primary/5', 'animate-pulse')
                    setTimeout(() => {
                        element.classList.remove('animate-pulse')
                    }, 3000)
                }
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [highlightNoteId, items])

    const renderContent = (content: string) => {
        if (!content) return null
        const parts = content.split(/(@[a-zA-Z0-9\u0590-\u05FF]+)/g)
        return parts.map((part, i) => {
            if (part.startsWith("@")) {
                return <span key={i} className="text-primary font-bold">{part}</span>
            }
            return part
        })
    }

    const handleUpdateNote = async (noteId: string) => {
        if (!editContent.trim()) return
        setIsUpdating(true)
        try {
            const res = await fetch(`/api/tasks/${taskId}/notes/${noteId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: editContent })
            })
            if (res.ok) {
                toast.success("Note updated")
                setEditingNoteId(null)
                if (onUpdate) onUpdate()
            } else {
                toast.error("Failed to update note")
            }
        } catch (err) {
            console.error(err)
            toast.error("Something went wrong")
        } finally {
            setIsUpdating(false)
        }
    }

    const handleDeleteNote = async (noteId: string) => {
        if (!confirm("Are you sure you want to delete this message?")) return
        try {
            const res = await fetch(`/api/tasks/${taskId}/notes/${noteId}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                toast.success("Message deleted")
                if (onUpdate) onUpdate()
            } else {
                toast.error("Failed to delete message")
            }
        } catch (err) {
            console.error(err)
            toast.error("Something went wrong")
        }
    }

    const handleDeleteAttachment = async (attachmentId: string) => {
        if (!confirm("Are you sure you want to delete this file?")) return
        try {
            const res = await fetch(`/api/tasks/${taskId}/attachments/${attachmentId}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                toast.success("File deleted")
                if (onUpdate) onUpdate()
            } else {
                toast.error("Failed to delete file")
            }
        } catch (err) {
            console.error(err)
            toast.error("Something went wrong")
        }
    }

    const groupedItems = React.useMemo(() => {
        const groups: GroupedItem[] = []

        // Sort items by date ascending for easier grouping
        const sortedItems = [...items].sort((a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )

        sortedItems.forEach(item => {
            const lastGroup = groups[groups.length - 1]
            const itemTime = new Date(item.createdAt).getTime()
            const lastTime = lastGroup ? new Date(lastGroup.createdAt).getTime() : 0

            // Check if we should group this item with the last one
            // We group if:
            // 1. Last group is a 'message'
            // 2. Current item is a 'note' or 'file'
            // 3. Same user
            // 4. Within 2 minutes
            const isNoteOrFile = item.type === 'note' || item.type === 'file'
            const canGroup = lastGroup &&
                lastGroup.type === 'message' &&
                isNoteOrFile &&
                lastGroup.user.name === item.user.name &&
                (itemTime - lastTime) < 2 * 60 * 1000

            if (canGroup) {
                if (item.type === 'note') {
                    lastGroup.content = (lastGroup.content || "") + (lastGroup.content ? "\n" : "") + item.content
                } else if (item.type === 'file') {
                    if (!lastGroup.files) lastGroup.files = []
                    lastGroup.files.push({
                        id: item.id,
                        fileName: item.fileName!,
                        fileUrl: item.fileUrl!,
                        fileSize: item.fileSize || 0
                    })
                }
                // Update timestamp to the latest item in the group
                lastGroup.createdAt = item.createdAt
            } else {
                // Start a new group
                if (item.type === 'activity') {
                    groups.push({
                        id: item.id,
                        type: 'activity',
                        createdAt: item.createdAt,
                        user: item.user,
                        action: item.action,
                        details: item.details
                    })
                } else {
                    groups.push({
                        id: item.id,
                        type: 'message',
                        createdAt: item.createdAt,
                        user: item.user,
                        content: item.type === 'note' ? item.content : undefined,
                        files: item.type === 'file' ? [{
                            id: item.id,
                            fileName: item.fileName!,
                            fileUrl: item.fileUrl!,
                            fileSize: item.fileSize || 0
                        }] : []
                    })
                }
            }
        })

        // Return sorted DESC for display
        return groups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }, [items])

    if (isLoading) {
        return <div className="p-4 text-center text-muted-foreground">Loading updates...</div>
    }

    if (groupedItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                <p>No activity yet. Start the conversation!</p>
            </div>
        )
    }

    return (
        <ScrollArea className="h-full pr-4">
            <div className="space-y-6 pl-2">
                {groupedItems.map((group, index) => {
                    const isLast = index === groupedItems.length - 1
                    const isOwnMessage = currentUserId && group.user.id === currentUserId
                    const isEditing = editingNoteId === group.id

                    return (
                        <div key={group.id} className="relative flex gap-4 group/item">
                            {/* Vertical Line */}
                            {!isLast && (
                                <div className="absolute left-[19px] top-10 bottom-[-24px] w-[2px] bg-border" />
                            )}

                            <Avatar className="w-10 h-10 border border-border flex-shrink-0 z-10">
                                <AvatarImage src={group.user.image || ""} />
                                <AvatarFallback>{group.user.name?.[0] || "?"}</AvatarFallback>
                            </Avatar>

                            <div className="space-y-1 pt-1 flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm text-foreground">
                                            {group.user.name || "Unknown User"}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {format(new Date(group.createdAt), "MMM d, h:mm a")}
                                        </span>
                                    </div>

                                    {group.type === 'message' && isOwnMessage && !isEditing && (
                                        <div className="opacity-0 group-hover/item:opacity-100 transition-opacity">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-32">
                                                    {group.content && (
                                                        <DropdownMenuItem onClick={() => {
                                                            setEditingNoteId(group.id)
                                                            setEditContent(group.content || "")
                                                        }}>
                                                            <Pencil className="mr-2 h-4 w-4" />
                                                            <span>Edit</span>
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem
                                                        onClick={() => handleDeleteNote(group.id)}
                                                        className="text-destructive focus:text-destructive"
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        <span>Delete</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    )}
                                </div>

                                {group.type === 'message' && (
                                    <div className="space-y-2 mt-1">
                                        {isEditing ? (
                                            <div className="space-y-2 bg-muted/30 p-3 rounded-lg border border-primary/20">
                                                <Textarea
                                                    value={editContent}
                                                    onChange={(e) => setEditContent(e.target.value)}
                                                    className="min-h-[80px] text-sm bg-background"
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setEditingNoteId(null)}
                                                        disabled={isUpdating}
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleUpdateNote(group.id)}
                                                        disabled={isUpdating || !editContent.trim()}
                                                    >
                                                        {isUpdating ? "Saving..." : "Save"}
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            group.content && (
                                                <div id={`note-${group.id}`} className="bg-muted/50 p-3 rounded-lg text-sm whitespace-pre-wrap border border-border/50 transition-all duration-500">
                                                    {renderContent(group.content)}
                                                </div>
                                            )
                                        )}
                                        {group.files && group.files.length > 0 && (
                                            <div className="grid gap-2">
                                                {group.files.map(file => (
                                                    <div key={file.id} className="flex items-center justify-between p-3 bg-card border rounded-lg group/file hover:bg-muted/20 transition-colors">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                                                <FileText className="h-4 w-4 text-blue-500" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-medium truncate">{file.fileName}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {formatFileSize(file.fileSize || 0)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                                                <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" download>
                                                                    <Download className="h-4 w-4 text-muted-foreground" />
                                                                </a>
                                                            </Button>
                                                            {isOwnMessage && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 opacity-0 group-hover/file:opacity-100 hover:text-destructive transition-all"
                                                                    onClick={() => handleDeleteAttachment(file.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {group.type === 'activity' && (
                                    <div className="text-sm text-muted-foreground italic flex items-center gap-2">
                                        <Activity className="w-3 h-3" />
                                        {formatAction(group.action || "", group.details)}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </ScrollArea>
    )
}

function formatFileSize(bytes: number) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatAction(action: string, details?: string | null) {
    switch (action) {
        case "STATUS_CHANGE": return details?.replace("Changed status to", "changed status to") || "changed status"
        case "PRIORITY_CHANGE": return details?.replace("Changed priority to", "changed priority to") || "changed priority"
        case "ASSIGN_USER": return details?.replace("Assigned", "assigned") || "assigned users"
        case "REMOVE_USER": return details?.replace("Removed", "removed") || "removed users"
        case "TASK_CREATED": return "created task"
        default: return action.replace(/_/g, " ").toLowerCase()
    }
}
