"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Plus, Pencil } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import { useLanguage } from "@/lib/useLanguage"
import { filterHierarchyGroup } from "@/lib/hierarchy-utils"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"

interface BaseCalendarEvent {
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
    recurrenceEnd?: Date | string | null
    createdBy?: {
        name: string
        email: string
    }
    participants?: Array<{
        user: { id?: string; name: string; email: string }
    }>
}

interface CreateEventDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    defaultDate?: Date
    projectId?: string | null
    event?: BaseCalendarEvent
    mode?: 'create' | 'edit'
    onOptimisticEventCreate?: (event: BaseCalendarEvent) => void
    fromMonthView?: boolean
}

export function CreateEventDialog({
    open,
    onOpenChange,
    defaultDate,
    projectId,
    event,
    mode = 'create',
    onOptimisticEventCreate,
    fromMonthView = false
}: CreateEventDialogProps) {
    const router = useRouter()
    const { data: session } = useSession()
    const { t, isRTL } = useLanguage()
    const isDesktop = useMediaQuery("(min-width: 768px)")
    const [loading, setLoading] = useState(false)

    // Form state
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [type, setType] = useState("MEETING")
    const [location, setLocation] = useState("")
    const [allDay, setAllDay] = useState(false)
    const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string | null; managerId?: string | null; depth?: number }>>([])
    const [participantIds, setParticipantIds] = useState<string[]>([])
    const [showEventToMe, setShowEventToMe] = useState(true)
    const [recurrence, setRecurrence] = useState<string>("NONE")
    const [recurrenceEnd, setRecurrenceEnd] = useState("")
    const [pendingSave, setPendingSave] = useState(false)

    // Helper to sort users: Current User first, then Hierarchy
    const sortUsersHierarchically = (usersToSort: Array<{ id: string; name: string | null; email: string | null; managerId?: string | null }>, meId?: string) => {
        if (!usersToSort.length) return []

        let me: typeof users[0] | undefined
        const others = usersToSort.map(u => ({ ...u, depth: 0 })) // Initialize depth for all users

        // 1. Extract Me
        if (meId) {
            const meIndex = others.findIndex(u => u.id === meId)
            if (meIndex >= 0) {
                me = others[meIndex]
                others.splice(meIndex, 1)
            }
        }

        // 2. Build Tree
        const userMap = new Map<string, typeof users[0]>()
        const childrenMap = new Map<string, typeof users[0][]>()

        others.forEach(u => {
            userMap.set(u.id, u)
            if (!childrenMap.has(u.id)) childrenMap.set(u.id, [])
        })

        const roots: typeof users = []

        others.forEach(u => {
            // If manager exists in the filtered list, add as child
            if (u.managerId && userMap.has(u.managerId)) {
                childrenMap.get(u.managerId)?.push(u)
            } else {
                // Otherwise it's a root (relative to this list)
                roots.push(u)
            }
        })

        // 3. DFS Flatten with Depth
        const flattened: typeof users = []
        const traverse = (nodes: typeof users, currentDepth: number) => {
            // Sort siblings alphabetically
            nodes.sort((a, b) => (a.name || a.email || "").localeCompare(b.name || b.email || ""))
                .forEach(node => {
                    flattened.push({ ...node, depth: currentDepth })
                    const children = childrenMap.get(node.id)
                    if (children && children.length > 0) {
                        traverse(children, currentDepth + 1)
                    }
                })
        }

        traverse(roots, 0)

        return me ? [{ ...me, depth: 0 }, ...flattened] : flattened
    }

    // Date/Time state
    const formatDateLocal = (date: Date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    const [startDate, setStartDate] = useState(
        fromMonthView ? formatDateLocal(new Date()) : (defaultDate ? formatDateLocal(defaultDate) : formatDateLocal(new Date()))
    )
    const [startTime, setStartTime] = useState("06:00")
    const [endDate, setEndDate] = useState(
        fromMonthView ? "" : (defaultDate ? formatDateLocal(defaultDate) : formatDateLocal(new Date()))
    )
    const [endTime, setEndTime] = useState("07:00")

    // Initialize/Reset form based on mode and open state
    useEffect(() => {
        if (open) {
            // Fetch users list only if not already loaded
            if (users.length === 0) {
                fetch("/api/team?all=true")
                    .then(res => res.json())
                    .then(data => {
                        if (Array.isArray(data)) {
                            // Filter to hierarchy group (manager, siblings, direct reports)
                            const currentUser = data.find((u: { id: string; managerId?: string | null }) => u.id === session?.user?.id)
                            if (currentUser) {
                                const filteredUsers = filterHierarchyGroup(
                                    data.map((u: { id: string; name: string | null; email: string | null; managerId?: string | null }) => ({
                                        id: u.id,
                                        name: u.name,
                                        email: u.email,
                                        managerId: u.managerId || null
                                    })),
                                    {
                                        id: currentUser.id,
                                        managerId: currentUser.managerId || null
                                    }
                                )

                                // Sort hierarchically
                                const sortedUsers = sortUsersHierarchically(filteredUsers, session?.user?.id)
                                setUsers(sortedUsers)
                            } else {
                                // Fallback: just sort if we can't find current user
                                const sortedUser = [...data].sort((a, b) => {
                                    if (a.id === session?.user?.id) return -1
                                    if (b.id === session?.user?.id) return 1
                                    return (a.name || "").localeCompare(b.name || "")
                                })
                                setUsers(sortedUser)
                            }
                        }
                    })
                    .catch(() => {
                        console.error("Failed to load users")
                        setUsers([])
                    })

            }

            if (mode === 'edit' && event) {
                setTitle(event.title)
                setDescription(event.description || "")
                setType(event.type)
                setLocation(event.location || "")
                setAllDay(event.allDay)

                // Populate participants
                if (event.participants) {
                    const participantIdsList = event.participants
                        .map((p: { user: { id?: string } }) => p.user.id)
                        .filter((id): id is string => id !== undefined)
                    setParticipantIds(participantIdsList)
                    // Set showEventToMe if current user is in participants
                    if (session?.user?.id && participantIdsList.includes(session.user.id)) {
                        setShowEventToMe(true)
                    } else {
                        setShowEventToMe(false)
                    }
                }

                const start = new Date(event.startTime)
                const end = new Date(event.endTime)

                setStartDate(formatDateLocal(start))
                setStartTime(start.toTimeString().slice(0, 5))
                setEndDate(formatDateLocal(end))
                setEndTime(end.toTimeString().slice(0, 5))

                // Populate recurrence fields
                setRecurrence(event.recurrence || "NONE")
                setRecurrenceEnd(event.recurrenceEnd ? formatDateLocal(new Date(event.recurrenceEnd)) : "")
            } else {
                // Reset for create mode
                resetForm()
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, mode, event, defaultDate, fromMonthView])

    const handleSubmit = async (e: React.FormEvent | null, scope?: string) => {
        if (e) e.preventDefault()

        // If "showEventToMe" is checked, ensure currentUserId is in participantIds
        let finalParticipantIds = [...participantIds]
        if (showEventToMe && session?.user?.id && !finalParticipantIds.includes(session.user.id)) {
            // Add currentUserId if showEventToMe is checked but user is not in participantIds
            finalParticipantIds.push(session.user.id)
        } else if (!showEventToMe && session?.user?.id && finalParticipantIds.includes(session.user.id)) {
            // Remove currentUserId only if showEventToMe is unchecked AND user is not manually selected in Participants
            // If user manually selected themselves in Participants, keep them even if showEventToMe is unchecked
            const wasManuallySelected = participantIds.includes(session.user.id)
            if (!wasManuallySelected) {
                finalParticipantIds = finalParticipantIds.filter(id => id !== session.user.id)
            }
        }

        if (finalParticipantIds.length === 0) {
            toast.error("Please select at least one participant")
            return
        }

        setLoading(true)

        // Create temp event for optimistic UI
        if (mode === 'create' && onOptimisticEventCreate) {
            const isCurrentUserParticipant = session?.user?.id && finalParticipantIds.includes(session.user.id)

            if (isCurrentUserParticipant) {
                const tempEvent = {
                    id: Math.random().toString(), // Temp ID
                    title,
                    description,
                    startTime: allDay ? new Date(startDate) : new Date(`${startDate}T${startTime}`),
                    endTime: allDay ? new Date(endDate) : new Date(`${endDate}T${endTime}`),
                    allDay,
                    type,
                    location,
                    createdBy: {
                        name: session?.user?.name || "You",
                        email: session?.user?.email || ""
                    },
                    participants: finalParticipantIds.map(id => {
                        const user = users.find(u => u.id === id)
                        return {
                            user: {
                                name: user?.name || "Unknown",
                                email: user?.email || ""
                            }
                        }
                    })
                }
                onOptimisticEventCreate(tempEvent)
            }
            onOpenChange(false) // Close immediately regardless of visibility
        }

        try {
            const startDateTime = allDay
                ? new Date(startDate).toISOString()
                : new Date(`${startDate}T${startTime}`).toISOString()

            const endDateTime = allDay
                ? new Date(endDate).toISOString()
                : new Date(`${endDate}T${endTime}`).toISOString()

            // Check if editing a recurring event
            const isRecurring = mode === 'edit' && event && event.recurrence && event.recurrence !== 'NONE';

            let requestScope = 'ALL'
            let dateParam = ''

            if (isRecurring && !scope) {
                setLoading(false) // Reset loading since we're not submitting yet
                setPendingSave(true)
                return
            }

            if (scope) {
                requestScope = scope
                // For scope=THIS or FUTURE, we need the date of the occurrence
                // The 'event' prop usually has the START TIME of the specific occurrence
                if (event && event.startTime) {
                    dateParam = new Date(event.startTime).toISOString()
                }
            }

            // ... rest of logic


            const url = mode === 'edit'
                ? (requestScope !== 'ALL' && dateParam
                    ? `/api/events/${event?.id}?scope=${requestScope}&date=${dateParam}`
                    : `/api/events/${event?.id}`)
                : "/api/events"
            const method = mode === 'edit' ? "PATCH" : "POST"

            // Debug logging for recurring event edits
            console.log('[Edit Event] Request:', { url, method, scope: requestScope, isRecurring, title, startDateTime, endDateTime })

            const res = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    description: description || null,
                    startTime: startDateTime,
                    endTime: endDateTime,
                    allDay,
                    type,
                    location: location || null,
                    projectId,
                    participantIds: finalParticipantIds,
                    reminderMinutes: [],
                    // Send recurrence as-is, API will handle based on scope
                    recurrence: recurrence === "NONE" ? null : recurrence,
                    recurrenceEnd: (recurrence !== "NONE" && recurrenceEnd) ? new Date(recurrenceEnd).toISOString() : null
                })
            })

            console.log('[Edit Event] Response:', { ok: res.ok, status: res.status })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || `Failed to ${mode} event`)
            }

            toast.success(`Event ${mode === 'edit' ? 'updated' : 'created'} successfully`)
            router.refresh()
            onOpenChange(false)
            resetForm()
        } catch (error) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : `Failed to ${mode} event`)
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        if (mode === 'edit') return // Don't reset if we are just switching back to edit mode logic handled in effect

        setTitle("")
        setDescription("")
        setType("MEETING")
        setLocation("")
        setAllDay(false)
        setParticipantIds(session?.user?.id ? [session.user.id] : [])
        setShowEventToMe(true)
        setRecurrence("NONE")
        setRecurrenceEnd("")

        // If fromMonthView, use current date for startDate and leave endDate empty
        if (fromMonthView) {
            const today = new Date()
            const dateStr = formatDateLocal(today)
            setStartDate(dateStr)
            setStartTime("06:00")
            setEndDate("")
            setEndTime("07:00")
            return
        }

        const baseDate = defaultDate || new Date()
        const dateStr = formatDateLocal(baseDate)
        const hour = baseDate.getHours()
        const minutes = baseDate.getMinutes()

        // If defaultDate is provided AND has a specific time (not midnight), use that time
        // Otherwise default to 6-7 AM
        const hasSpecificTime = hour !== 0 || minutes !== 0
        const startHourStr = (defaultDate && hasSpecificTime) ? String(hour).padStart(2, '0') + ":00" : "06:00"
        const endHourStr = (defaultDate && hasSpecificTime) ? String((hour + 1) % 24).padStart(2, '0') + ":00" : "07:00"

        setStartDate(dateStr)
        setStartTime(startHourStr)
        setEndDate(dateStr)
        setEndTime(endHourStr)
    }

    const toggleUser = (userId: string) => {
        setParticipantIds(prev => {
            const newIds = prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]

            // If current user is being toggled, sync showEventToMe state
            if (session?.user?.id && userId === session.user.id) {
                setShowEventToMe(newIds.includes(session.user.id))
            }

            return newIds
        })
    }

    const toggleSelectAll = () => {
        if (participantIds.length === users.length) {
            setParticipantIds([])
        } else {
            setParticipantIds(users.map(u => u.id))
        }
    }

    // Form content component (shared between Dialog and Sheet)
    const FormContent = ({ formId }: { formId?: string }) => (
        <form id={formId} onSubmit={handleSubmit}>
                        <div className="space-y-4 py-4">
                            {/* Title */}
                            <div className="space-y-2">
                                <Label htmlFor="title">{t('calendar.title')} *</Label>
                                <Input
                                    id="title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder=""
                                    required
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <Label htmlFor="description">{t('calendar.description')}</Label>
                                <Textarea
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder={t('tasks.addTaskDescription')}
                                    rows={3}
                                />
                            </div>

                            {/* Type */}
                            <div className="space-y-2">
                                <Label htmlFor="type">{t('calendar.eventType')}</Label>
                                <Select value={type} onValueChange={setType}>
                                    <SelectTrigger id="type">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MEETING">{t('calendar.meeting')}</SelectItem>
                                        <SelectItem value="APPOINTMENT">{t('calendar.appointment')}</SelectItem>
                                        <SelectItem value="TASK_TIME">{t('calendar.taskTime')}</SelectItem>
                                        <SelectItem value="BREAK">{t('calendar.break')}</SelectItem>
                                        <SelectItem value="PERSONAL">{t('calendar.personal')}</SelectItem>
                                        <SelectItem value="OTHER">{t('calendar.other')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Location */}
                            <div className="space-y-2">
                                <Label htmlFor="location">{t('calendar.location')}</Label>
                                <Input
                                    id="location"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder={t('calendar.location')}
                                />
                            </div>

                            {/* Day - All Day Toggle, Start Date/Time, End Date/Time */}
                            <div className="space-y-4">
                                {/* All Day Toggle */}
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="allDay"
                                        checked={allDay}
                                        onChange={(e) => setAllDay(e.target.checked)}
                                        className="h-4 w-4"
                                    />
                                    <Label htmlFor="allDay" className="cursor-pointer">{t('calendar.allDayEvent')}</Label>
                                </div>

                                {/* Start Date/Time */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="startDate">{t('calendar.startDate')} *</Label>
                                        <Input
                                            id="startDate"
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            required
                                        />
                                    </div>
                                    {!allDay && (
                                        <div className="space-y-2">
                                            <Label htmlFor="startTime">{t('calendar.startTime')}</Label>
                                            <Input
                                                id="startTime"
                                                type="time"
                                                value={startTime}
                                                onChange={(e) => setStartTime(e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* End Date/Time */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="endDate">{t('calendar.endDate')} *</Label>
                                        <Input
                                            id="endDate"
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            required
                                        />
                                    </div>
                                    {!allDay && (
                                        <div className="space-y-2">
                                            <Label htmlFor="endTime">{t('calendar.endTime')}</Label>
                                            <Input
                                                id="endTime"
                                                type="time"
                                                value={endTime}
                                                onChange={(e) => setEndTime(e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Recurrence */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="recurrence">{t('calendar.recurrence') || "Recurrence"}</Label>
                                    <Select value={recurrence} onValueChange={setRecurrence}>
                                        <SelectTrigger id="recurrence">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NONE">{t('calendar.recurrenceNone') || "None"}</SelectItem>
                                            <SelectItem value="DAILY">{t('calendar.recurrenceDaily') || "Daily"}</SelectItem>
                                            <SelectItem value="WEEKLY">{t('calendar.recurrenceWeekly') || "Weekly"}</SelectItem>
                                            <SelectItem value="MONTHLY">{t('calendar.recurrenceMonthly') || "Monthly"}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {recurrence !== "NONE" && (
                                    <div className="space-y-2">
                                        <Label htmlFor="recurrenceEnd">{t('calendar.recurrenceEnd') || "End Date"}</Label>
                                        <Input
                                            id="recurrenceEnd"
                                            type="date"
                                            value={recurrenceEnd}
                                            onChange={(e) => setRecurrenceEnd(e.target.value)}
                                            min={startDate}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Participants */}
                            {users.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>{t('calendar.participants')}</Label>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                                            onClick={toggleSelectAll}
                                        >
                                            {participantIds.length === users.length ? t('common.cancel') : t('common.selectAll')}
                                        </Button>
                                    </div>
                                    <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-2">
                                        {users.map(user => {
                                            const isCurrentUser = user.id === session?.user?.id
                                            return (
                                                <div key={user.id} className="flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        id={`user-${user.id}`}
                                                        checked={participantIds.includes(user.id)}
                                                        onChange={() => toggleUser(user.id)}
                                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary flex-shrink-0"
                                                    />
                                                    <Label htmlFor={`user-${user.id}`} className="cursor-pointer text-sm font-normal flex items-center gap-1">
                                                        {user.name || user.email}
                                                        {isCurrentUser && <span className="text-xs text-muted-foreground">{t('common.you')}</span>}
                                                    </Label>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Show to me checkbox - only in create mode and when there are other participants */}
                            {mode === 'create' && session?.user?.id && users.some(u => u.id !== session.user.id) && (
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="showEventToMe"
                                        checked={showEventToMe}
                                        onCheckedChange={(checked) => setShowEventToMe(checked as boolean)}
                                    />
                                    <Label htmlFor="showEventToMe" className="cursor-pointer text-sm font-normal">
                                        {t('calendar.showThisEventToMe')}
                                    </Label>
                                </div>
                            )}
            </div>
        </form>
    )

    // Desktop: Dialog
    if (isDesktop) {
        return (
            <>
                <Dialog open={open} onOpenChange={onOpenChange}>
                    <DialogContent
                        className={cn(
                            "sm:max-w-[500px] max-h-[90vh] overflow-y-auto",
                            isRTL ? "[&>button]:left-4 [&>button]:right-auto" : "[&>button]:right-4 [&>button]:left-auto"
                        )}
                        dir={isRTL ? "rtl" : "ltr"}
                    >
                        <DialogHeader className={isRTL ? "text-right" : "text-left"}>
                            <DialogTitle className={isRTL ? "text-right" : "text-left"}>{mode === 'edit' ? t('calendar.editEvent') : t('calendar.createNewEvent')}</DialogTitle>
                            <DialogDescription className={isRTL ? "text-right" : "text-left"}>
                                {mode === 'edit' ? t('calendar.updateEventDetails') : t('calendar.addEventToCalendar')}
                            </DialogDescription>
                        </DialogHeader>

                        <FormContent formId="event-form-desktop" />

                        <DialogFooter className={cn("gap-2", isRTL ? "justify-start" : "justify-end")}>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={loading}
                            >
                                {t('calendar.cancel')}
                            </Button>
                            <Button type="submit" form="event-form-desktop" disabled={loading}>
                                {loading && <Loader2 className={cn(isRTL ? "ml-2" : "mr-2", "h-4 w-4 animate-spin")} />}
                                {mode === 'edit' ? <Pencil className={cn(isRTL ? "ml-2" : "mr-2", "h-4 w-4")} /> : <Plus className={cn(isRTL ? "ml-2" : "mr-2", "h-4 w-4")} />}
                                {mode === 'edit' ? t('calendar.editEvent') : t('calendar.createEvent')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </>
        )
    }

    // Mobile: Sheet
    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent
                    side="bottom"
                    className={cn(
                        "h-[95vh] rounded-t-xl px-4 pb-0 pt-6",
                        isRTL && "[&>button]:left-4 [&>button]:right-auto"
                    )}
                    dir={isRTL ? "rtl" : "ltr"}
                >
                    <div className="flex flex-col h-full">
                        <SheetHeader className={cn("mb-4 shrink-0", isRTL ? "text-right" : "text-left")}>
                            <SheetTitle className={isRTL ? "text-right" : "text-left"}>
                                {mode === 'edit' ? t('calendar.editEvent') : t('calendar.createNewEvent')}
                            </SheetTitle>
                            <SheetDescription className={isRTL ? "text-right" : "text-left"}>
                                {mode === 'edit' ? t('calendar.updateEventDetails') : t('calendar.addEventToCalendar')}
                            </SheetDescription>
                        </SheetHeader>
                        <div className="flex-1 overflow-y-auto pb-4 min-h-0">
                            <FormContent formId="event-form-mobile" />
                        </div>
                        <SheetFooter className={cn("gap-2 pt-4 border-t shrink-0 bg-background pb-4", isRTL ? "justify-start" : "justify-end")}>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={loading}
                                className="flex-1"
                            >
                                {t('calendar.cancel')}
                            </Button>
                            <Button 
                                type="submit" 
                                form="event-form-mobile" 
                                disabled={loading}
                                className="flex-1"
                            >
                                {loading && <Loader2 className={cn(isRTL ? "ml-2" : "mr-2", "h-4 w-4 animate-spin")} />}
                                {mode === 'edit' ? <Pencil className={cn(isRTL ? "ml-2" : "mr-2", "h-4 w-4")} /> : <Plus className={cn(isRTL ? "ml-2" : "mr-2", "h-4 w-4")} />}
                                {mode === 'edit' ? t('calendar.editEvent') : t('calendar.createEvent')}
                            </Button>
                        </SheetFooter>
                    </div>
                </SheetContent>
            </Sheet>

            <Dialog open={pendingSave} onOpenChange={setPendingSave}>
                <DialogContent className="sm:max-w-[500px] z-[60]">
                    <DialogHeader>
                        <DialogTitle className="text-xl">{t('calendar.editRecurringPrompt')}</DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            {t('calendar.editRecurringPrompt')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 mt-6">
                        {/* Update This Occurrence Only */}
                        <button
                            onClick={() => { setPendingSave(false); handleSubmit(null, 'THIS') }}
                            className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all group"
                        >
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5">
                                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                        {t('calendar.editThisOccurrence')}
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                        {t('calendar.editThisOccurrenceDesc')}
                                    </div>
                                </div>
                            </div>
                        </button>

                        {/* Update This and Future */}
                        <button
                            onClick={() => { setPendingSave(false); handleSubmit(null, 'FUTURE') }}
                            className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all group"
                        >
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5">
                                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                        {t('calendar.editFutureOccurrences')}
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                        {t('calendar.editFutureOccurrencesDesc')}
                                    </div>
                                </div>
                            </div>
                        </button>

                        {/* Update Entire Series */}
                        <button
                            onClick={() => { setPendingSave(false); handleSubmit(null, 'ALL') }}
                            className="w-full text-left p-4 rounded-lg border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-all group"
                        >
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5">
                                    <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <div className="font-semibold text-primary">
                                        {t('calendar.editAllOccurrences')}
                                    </div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                        {t('calendar.editAllOccurrencesDesc')}
                                    </div>
                                </div>
                            </div>
                        </button>

                        {/* Cancel */}
                        <Button
                            variant="ghost"
                            onClick={() => setPendingSave(false)}
                            className="mt-2"
                        >
                            {t('common.cancel')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
