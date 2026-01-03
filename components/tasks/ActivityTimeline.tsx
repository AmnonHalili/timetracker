import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format } from "date-fns"
import { Activity } from "lucide-react"

type ActivityParams = {
    id: string
    action: string
    details: string | null
    createdAt: string
    user: {
        name: string | null
        image: string | null
    }
}

interface ActivityTimelineProps {
    activities: ActivityParams[]
    isLoading: boolean
}

export function ActivityTimeline({ activities, isLoading }: ActivityTimelineProps) {
    if (isLoading) {
        return <div className="p-4 text-center text-muted-foreground">Loading activity...</div>
    }

    if (activities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Activity className="w-8 h-8 mb-2 opacity-50" />
                <p>No activity yet</p>
            </div>
        )
    }

    return (
        <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-6 pl-2">
                {activities.map((activity, index) => {
                    const isLast = index === activities.length - 1

                    return (
                        <div key={activity.id} className="relative flex gap-4">
                            {/* Vertical Line */}
                            {!isLast && (
                                <div className="absolute left-[19px] top-10 bottom-[-24px] w-[2px] bg-border" />
                            )}

                            <Avatar className="w-10 h-10 border border-border flex-shrink-0">
                                <AvatarImage src={activity.user.image || ""} />
                                <AvatarFallback>{activity.user.name?.[0] || "?"}</AvatarFallback>
                            </Avatar>

                            <div className="space-y-1 pt-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm text-foreground">
                                        {activity.user.name || "Unknown User"}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {format(new Date(activity.createdAt), "MMM d, h:mm a")}
                                    </span>
                                </div>
                                <div className="text-sm text-foreground">
                                    {formatAction(activity.action)}
                                </div>
                                {activity.details && (
                                    <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md mt-1">
                                        {activity.details}
                                    </p>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </ScrollArea>
    )
}

function formatAction(action: string) {
    switch (action) {
        case "STATUS_CHANGE": return "changed the status"
        case "PRIORITY_CHANGE": return "changed the priority"
        case "ASSIGN_USER": return "assigned users"
        case "REMOVE_USER": return "removed users"
        case "COMMENT_ADDED": return "commented"
        case "FILE_UPLOADED": return "uploaded a file"
        case "FILE_DELETED": return "deleted a file"
        case "TASK_CREATED": return "created the task"
        case "DEADLINE_CHANGE": return "changed the deadline"
        default: return action.replace(/_/g, " ").toLowerCase()
    }
}
