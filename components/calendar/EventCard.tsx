"use client"

import { useState } from "react"
import { cn, formatTimeWithAMPM } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Users, Trash2, MoreVertical, Pencil, Check } from "lucide-react"
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CreateEventDialog } from "./CreateEventDialog"
import { CreateTaskDialog } from "../tasks/CreateTaskDialog"

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
    MEETING: "bg-[#0EA5E9]/10 text-[#0284C7] border-[#0EA5E9]/20",
    APPOINTMENT: "bg-[#0EA5E9]/10 text-[#0284C7] border-[#0EA5E9]/20",
    TASK_TIME: "bg-[#004B7C]/10 text-[#004B7C] border-[#004B7C]/20",
    BREAK: "bg-gray-500/10 text-gray-700 border-gray-500/20",
    PERSONAL: "bg-[#0EA5E9]/10 text-[#0284C7] border-[#0EA5E9]/20",
    OTHER: "bg-[#0EA5E9]/10 text-[#0284C7] border-[#0EA5E9]/20",
}

const eventTypeBadgeColors = {
    MEETING: "bg-[#0EA5E9]/10 text-[#0284C7] border-[#0EA5E9]/20",
    APPOINTMENT: "bg-[#0EA5E9]/10 text-[#0284C7] border-[#0EA5E9]/20",
    TASK_TIME: "bg-[#004B7C]/10 text-[#004B7C] border-[#004B7C]/20",
    BREAK: "bg-gray-500/10 text-gray-700 border-gray-500/20",
    PERSONAL: "bg-[#0EA5E9]/10 text-[#0284C7] border-[#0EA5E9]/20",
    OTHER: "bg-[#0EA5E9]/10 text-[#0284C7] border-[#0EA5E9]/20",
}

export function EventCard({ event, onClick, size = 'md', showDelete = false }: EventCardProps) {
    const router = useRouter()
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isMarkingDone, setIsMarkingDone] = useState(false)
    const [isDeleted, setIsDeleted] = useState(false)

    const start = new Date(event.startTime)
    const end = new Date(event.endTime)
    const badgeColor = eventTypeBadgeColors[event.type as keyof typeof eventTypeBadgeColors] || "bg-gray-100 text-gray-700 border-gray-200"

    const sizeClasses = {
        sm: "p-1.5 text-xs",
        md: "p-2 text-sm",
        lg: "p-3 text-base"
    }

    const handleDelete = async () => {
        // e.stopPropagation() is already handled in the dropdown handler if triggered from there
        setIsDeleting(true)

        // Optimistic update: Hide event immediately and close dialog
        setDeleteDialogOpen(false)
        setIsDeleted(true)

        try {
            const endpoint = event.type === 'TASK_TIME'
                ? `/api/tasks/${event.id}`
                : `/api/events/${event.id}`

            const res = await fetch(endpoint, {
                method: "DELETE",
            })

            if (!res.ok) {
                // If failed, revert the optimistic update
                setIsDeleted(false)
                const data = await res.json()
                throw new Error(data.error || "Failed to delete item")
            }

            toast.success(`${event.type === 'TASK_TIME' ? 'Task' : 'Event'} deleted successfully`)
            router.refresh()
        } catch (error) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : "Failed to delete item")
            setIsDeleted(false) // Show it again if failed
        } finally {
            setIsDeleting(false)
        }
    }

    const handleMarkDone = async () => {
        setIsMarkingDone(true)
        try {
            const res = await fetch(`/api/tasks/${event.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    status: "DONE",
                    isCompleted: true
                })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Failed to mark task as done")
            }

            toast.success("Task marked as done")
            router.refresh()
        } catch (error) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : "Failed to mark task as done")
        } finally {
            setIsMarkingDone(false)
        }
    }

    if (isDeleted) return null

    return (
        <>
            <div
                className={cn(
                    "relative rounded-md border transition-all group p-2 space-y-1",
                    eventTypeColors[event.type as keyof typeof eventTypeColors] || "bg-gray-100 text-gray-700",
                    onClick && "cursor-pointer hover:shadow-md",
                    sizeClasses[size]
                )}
                onClick={(e) => {
                    e.stopPropagation() // Prevent triggering hour click in DayView
                    onClick?.()
                }}
            >
                <div className="space-y-1">
                    {/* Title and Badge */}
                    <div className="flex items-start justify-between gap-2">
                        <span className={cn(
                            "font-semibold truncate flex-1",
                            size === 'sm' && "text-xs",
                            size === 'md' && "text-sm",
                            size === 'lg' && "text-base"
                        )}>
                            {event.title}
                        </span>
                        <div className="flex items-center gap-1 shrink-0 mr-8 self-center">
                            {size !== 'sm' && (
                                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5", badgeColor)}>
                                    {event.type}
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Actions Menu (Edit/Delete) - absolutely positioned */}
                    {showDelete && (
                        <div className="absolute right-2 top-1/2 -translate-y-[52%] z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 hover:bg-slate-200/50"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <MoreVertical className="h-3 w-3" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-32">
                                    {event.type === 'TASK_TIME' && (
                                        <DropdownMenuItem
                                            className="flex items-center gap-2 text-green-600 focus:text-green-700 focus:bg-green-50 cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleMarkDone()
                                            }}
                                            disabled={isMarkingDone}
                                        >
                                            <Check className="h-4 w-4" />
                                            <span>{isMarkingDone ? 'Marking...' : 'Done'}</span>
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                        className="flex items-center gap-2 cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setEditDialogOpen(true)
                                        }}
                                    >
                                        <Pencil className="h-4 w-4" />
                                        <span>Edit</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="flex items-center gap-2 text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setDeleteDialogOpen(true)
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        <span>Delete</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}

                    {/* Time */}
                    <div className="flex items-center gap-1 text-xs opacity-90">
                        {event.allDay ? (
                            <span>{event.type === 'TASK_TIME' ? 'Deadline: Today' : 'All day'}</span>
                        ) : (
                            <span>
                                {formatTimeWithAMPM(start)} - {formatTimeWithAMPM(end)}
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

            {/* Edit Dialog - Conditionally render Task or Event dialog */}
            {event.type === 'TASK_TIME' ? (
                <CreateTaskDialog
                    open={editDialogOpen}
                    onOpenChange={setEditDialogOpen}
                    task={event}
                    mode="edit"
                    users={[]} // It will fetch users internally
                />
            ) : (
                <CreateEventDialog
                    open={editDialogOpen}
                    onOpenChange={setEditDialogOpen}
                    event={event}
                    mode="edit"
                />
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Event</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete &quot;{event.title}&quot;? This action cannot be undone.
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
