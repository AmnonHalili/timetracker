import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from "date-fns"
import { Activity, FileText, Download, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"

export type UnifiedActivityItem = {
    id: string
    type: 'activity' | 'note' | 'file'
    createdAt: string
    user: {
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
    items: UnifiedActivityItem[]
    isLoading: boolean
}

export function UnifiedTimeline({ items, isLoading }: UnifiedTimelineProps) {
    if (isLoading) {
        return <div className="p-4 text-center text-muted-foreground">Loading updates...</div>
    }

    if (items.length === 0) {
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
                {items.map((item, index) => {
                    const isLast = index === items.length - 1

                    return (
                        <div key={`${item.type}-${item.id}`} className="relative flex gap-4">
                            {/* Vertical Line */}
                            {!isLast && (
                                <div className="absolute left-[19px] top-10 bottom-[-24px] w-[2px] bg-border" />
                            )}

                            <Avatar className="w-10 h-10 border border-border flex-shrink-0 z-10">
                                <AvatarImage src={item.user.image || ""} />
                                <AvatarFallback>{item.user.name?.[0] || "?"}</AvatarFallback>
                            </Avatar>

                            <div className="space-y-1 pt-1 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm text-foreground">
                                        {item.user.name || "Unknown User"}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {format(new Date(item.createdAt), "MMM d, h:mm a")}
                                    </span>
                                </div>

                                {/* Content based on type */}
                                {item.type === 'note' && (
                                    <div className="bg-muted/50 p-3 rounded-lg text-sm whitespace-pre-wrap mt-1 border border-border/50">
                                        {item.content}
                                    </div>
                                )}

                                {item.type === 'file' && (
                                    <div className="flex items-center justify-between p-3 bg-card border rounded-lg mt-1 group hover:bg-muted/20 transition-colors">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                                <FileText className="h-4 w-4 text-blue-500" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{item.fileName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatFileSize(item.fileSize || 0)}
                                                </p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                            <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" download>
                                                <Download className="h-4 w-4 text-muted-foreground" />
                                            </a>
                                        </Button>
                                    </div>
                                )}

                                {item.type === 'activity' && (
                                    <div className="text-sm text-muted-foreground italic flex items-center gap-2">
                                        <Activity className="w-3 h-3" />
                                        {formatAction(item.action || "", item.details)}
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
