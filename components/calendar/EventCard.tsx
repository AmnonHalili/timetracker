"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { Clock, MapPin, Users, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface EventCardProps {
    event: {
        id: string
        title: string
        description?: string | null
        startTime: Date | string
        endTime: Date | string
        allDay: boolean
        type: string
        location?: string | null
        createdBy?: {
            name: string
            email: string
        }
        participants?: Array<{
            user: {
                name: string
                email: string
            }
        }>
    }
    onClick?: () => void
    size?: 'sm' | 'md' | 'lg'
    showDelete?: boolean
}

const eventTypeColors = {
    MEETING: "bg-blue-100 text-blue-700 border-blue-200",
    APPOINTMENT: "bg-purple-100 text-purple-700 border-purple-200",
    TASK_TIME: "bg-green-100 text-green-700 border-green-200",
    BREAK: "bg-gray-100 text-gray-700 border-gray-200",
    PERSONAL: "bg-pink-100 text-pink-700 border-pink-200",
    OTHER: "bg-orange-100 text-orange-700 border-orange-200",
}

const eventTypeBadgeColors = {
    MEETING: "bg-blue-500/10 text-blue-700 border-blue-500/20",
    APPOINTMENT: "bg-purple-500/10 text-purple-700 border-purple-500/20",
    TASK_TIME: "bg-green-500/10 text-green-700 border-green-500/20",
    BREAK: "bg-gray-500/10 text-gray-700 border-gray-500/20",
    PERSONAL: "bg-pink-500/10 text-pink-700 border-pink-500/20",
    OTHER: "bg-orange-500/10 text-orange-700 border-orange-500/20",
}

export function EventCard({ event, onClick, size = 'md', showDelete = false }: EventCardProps) {
    const router = useRouter()
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const start = new Date(event.startTime)
    const end = new Date(event.endTime)
    const typeColor = eventTypeColors[event.type as keyof typeof eventTypeColors] || eventTypeColors.OTHER
    const badgeColor = eventTypeBadgeColors[event.type as keyof typeof eventTypeBadgeColors] || eventTypeBadgeColors.OTHER

    const sizeClasses = {
        sm: "p-1.5 text-xs",
        md: "p-2 text-sm",
        lg: "p-3 text-base"
    }

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/events/${event.id}`, {
                method: "DELETE",
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Failed to delete event")
            }

            toast.success("Event deleted successfully")
            router.refresh()
            setDeleteDialogOpen(false)
        } catch (error) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : "Failed to delete event")
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <>
            <div
                onClick={onClick}
                className={cn(
                    "rounded-md border cursor-pointer transition-all hover:shadow-md relative group",
                    typeColor,
                    sizeClasses[size],
                    onClick && "hover:scale-[1.02]"
                )}
            >
                <div className="space-y-1">
                    {/* Title and Badge */}
                    <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                            "font-semibold truncate flex-1",
                            size === 'sm' && "text-xs",
                            size === 'md' && "text-sm",
                            size === 'lg' && "text-base"
                        )}>
                            {event.title}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                            {size !== 'sm' && (
                                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5", badgeColor)}>
                                    {event.type}
                                </Badge>
                            )}
                            {showDelete && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setDeleteDialogOpen(true)
                                    }}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-1 text-xs opacity-90">
                        <Clock className="h-3 w-3" />
                        {event.allDay ? (
                            <span>All day</span>
                        ) : (
                            <span>
                                {format(start, 'h:mm a')} - {format(end, 'h:mm a')}
                            </span>
                        )}
                    </div>

                    {/* Location (for md and lg) */}
                    {size !== 'sm' && event.location && (
                        <div className="flex items-center gap-1 text-xs opacity-75 truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{event.location}</span>
                        </div>
                    )}

                    {/* Participants (for lg only) */}
                    {size === 'lg' && event.participants && event.participants.length > 0 && (
                        <div className="flex items-center gap-1 text-xs opacity-75">
                            <Users className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                                {event.participants.slice(0, 2).map(p => p.user.name.split(' ')[0]).join(', ')}
                                {event.participants.length > 2 && ` +${event.participants.length - 2}`}
                            </span>
                        </div>
                    )}

                    {/* Description snippet (for lg only) */}
                    {size === 'lg' && event.description && (
                        <p className="text-xs opacity-75 line-clamp-2 mt-1">
                            {event.description}
                        </p>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Event</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{event.title}"? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
