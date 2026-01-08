"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { formatTimeWithAMPM } from "@/lib/utils"
import { Calendar, MapPin, Trash2, Users } from "lucide-react"
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
import { useLanguage } from "@/lib/useLanguage"

interface EventDetailDialogProps {
    event: {
        id: string
        originalId?: string
        title: string
        description?: string | null
        startTime: Date | string
        endTime: Date | string
        allDay: boolean
        type: string
        location?: string | null
        recurrence?: string | null
        createdBy?: {
            name: string
            email: string
        }
        participants?: Array<{
            user: { name: string; email: string }
        }>
    } | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onOptimisticEventDelete?: (eventId: string) => void
}

const eventTypeColors: Record<string, string> = {
    MEETING: "bg-blue-500/10 text-blue-700 border-blue-500/20",
    APPOINTMENT: "bg-purple-500/10 text-purple-700 border-purple-500/20",
    TASK_TIME: "bg-green-500/10 text-green-700 border-green-500/20",
    BREAK: "bg-gray-500/10 text-gray-700 border-gray-500/20",
    PERSONAL: "bg-pink-500/10 text-pink-700 border-pink-500/20",
    OTHER: "bg-orange-500/10 text-orange-700 border-orange-500/20",
}

export function EventDetailDialog({ event, open, onOpenChange, onOptimisticEventDelete }: EventDetailDialogProps) {
    const router = useRouter()
    const { t } = useLanguage()
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    if (!event) return null

    const start = new Date(event.startTime)
    const end = new Date(event.endTime)
    const badgeColor = eventTypeColors[event.type] || eventTypeColors.OTHER

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            // If it's a recurring instance, use the original ID
            // Otherwise use the event ID (which might be synthetic or real depending on how it was passed, 
            // but for recurring instances expanded by API, originalId is set)
            // Fallback: strip suffix if no originalId but ID looks like pattern
            const idToDelete = event.originalId || (event.id.includes('_') ? event.id.split('_')[0] : event.id)

            // Optimistic update
            onOpenChange(false)
            setDeleteDialogOpen(false)
            onOptimisticEventDelete?.(event.id)

            const res = await fetch(`/api/events/${idToDelete}`, {
                method: "DELETE",
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Failed to delete event")
            }

            toast.success(t('calendar.eventDeleted'))
            router.refresh()
            onOpenChange(false)
            setDeleteDialogOpen(false)
        } catch (error) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : t('calendar.deleteError'))
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <div className="flex items-start justify-between gap-4">
                            <DialogTitle className="text-2xl">{event.title}</DialogTitle>
                            <Badge variant="outline" className={badgeColor}>
                                {event.type}
                            </Badge>
                        </div>
                        <DialogDescription>{t('calendar.eventDetails')}</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Date & Time */}
                        <div className="flex items-start gap-3">
                            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                                <p className="font-medium">
                                    {format(start, 'EEEE, MMMM d, yyyy')}
                                </p>
                                {event.allDay ? (
                                    <p className="text-sm text-muted-foreground">{t('calendar.allDay')}</p>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        {formatTimeWithAMPM(start)} - {formatTimeWithAMPM(end)}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Location */}
                        {event.location && (
                            <div className="flex items-start gap-3">
                                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <p className="text-sm">{event.location}</p>
                            </div>
                        )}

                        {/* Participants */}
                        {event.participants && event.participants.length > 0 && (
                            <div className="flex items-start gap-3">
                                <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium mb-1">{t('calendar.participants')}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {event.participants.map((p, i) => (
                                            <Badge key={i} variant="secondary" className="text-xs">
                                                {p.user.name}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        {event.description && (
                            <div className="space-y-2">
                                <p className="text-sm font-medium">{t('calendar.description')}</p>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {event.description}
                                </p>
                            </div>
                        )}

                        {/* Created By */}
                        {event.createdBy && (
                            <div className="pt-4 border-t">
                                <p className="text-xs text-muted-foreground">
                                    {t('calendar.createdBy')} {event.createdBy.name}
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            {t('common.close')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => setDeleteDialogOpen(true)}
                        >
                            <Trash2 className="h-4 w-4 me-2" />
                            {t('calendar.deleteEvent')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('calendar.deleteEvent')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('calendar.deleteConfirm').replace('{title}', event.title)}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isDeleting ? t('calendar.deleting') : t('common.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
