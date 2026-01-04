"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Clock, Paperclip, MessageSquare } from "lucide-react"

interface BoardCardProps {
    task: {
        id: string
        title: string
        priority: string
        assignees: { id: string; name: string | null }[]
        deadline: Date | string | null
        subtasks?: { id: string; isDone: boolean }[]
        _count?: {
            notes: number
            attachments: number
        }
    }
    onClick: (task: any) => void
}

export function BoardCard({ task, onClick }: BoardCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: task.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'HIGH': return 'bg-red-100 text-red-800'
            case 'MEDIUM': return 'bg-yellow-100 text-yellow-800'
            case 'LOW': return 'bg-green-100 text-green-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-3">
            <Card
                className="cursor-pointer hover:shadow-md transition-shadow bg-background"
                onClick={() => onClick(task)}
            >
                <CardHeader className="p-3 pb-2 space-y-0">
                    <div className="flex justify-between items-start mb-2">
                        <Badge variant="secondary" className={`text-[10px] px-1.5 h-5 ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                        </Badge>
                        {task.deadline && (
                            <div className="flex items-center text-[10px] text-muted-foreground">
                                <Clock className="w-3 h-3 mr-1" />
                                {new Date(task.deadline).toLocaleDateString()}
                            </div>
                        )}
                    </div>
                    <CardTitle className="text-sm font-medium leading-tight line-clamp-2">
                        {task.title}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-2">
                    <div className="flex justify-between items-center mt-2">
                        <div className="flex -space-x-2">
                            {task.assignees.slice(0, 3).map((user) => (
                                <Avatar key={user.id} className="w-6 h-6 border-2 border-background">
                                    <AvatarFallback className="text-[10px]">
                                        {user.name?.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            ))}
                            {task.assignees.length > 3 && (
                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] border-2 border-background z-10">
                                    +{task.assignees.length - 3}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            {(task._count?.notes || 0) > 0 && (
                                <div className="flex items-center text-[10px]">
                                    <MessageSquare className="w-3 h-3 mr-1" />
                                    {task._count?.notes}
                                </div>
                            )}
                            {(task._count?.attachments || 0) > 0 && (
                                <div className="flex items-center text-[10px]">
                                    <Paperclip className="w-3 h-3 mr-1" />
                                    {task._count?.attachments}
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
