"use client"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SecondaryManagersForm } from "./SecondaryManagersForm"
import { AssignManagerDialog } from "./AssignManagerDialog"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2, Edit, Check } from "lucide-react"
import { useLanguage } from "@/lib/useLanguage"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { canManageUser } from "@/lib/hierarchy-utils"
import { toast } from "sonner"

interface User {
    id: string
    name: string
    email: string
    role: string
    status: string
    image: string | null
    dailyTarget: number | null
    workDays: number[]
    weeklyHours?: Record<string, number> | null
    createdAt: Date
    jobTitle: string | null
    managerId: string | null
}

interface TeamListProps {
    users: User[]
    allUsers?: User[] // All users in the project (for finding managers that might not be visible)
    currentUserId: string
    currentUserRole: string
}

export function TeamList({ users, allUsers, currentUserId, currentUserRole }: TeamListProps) {
    const { t, isRTL } = useLanguage()
    const router = useRouter()
    const [localUsers, setLocalUsers] = useState<User[]>(users)
    const [selectedUser, setSelectedUser] = useState<User | null>(null)

    // Sync local users with prop users when props change (e.g. after router.refresh())
    // but only if we are not currently deleting to avoid jitter
    useEffect(() => {
        setLocalUsers(users)
    }, [users])
    // Helper function to convert legacy format to weeklyHours
    const getWeeklyHoursFromLegacy = (user: User): Record<number, number> => {
        if (user.weeklyHours) {
            const result: Record<number, number> = {}
            Object.entries(user.weeklyHours).forEach(([key, value]) => {
                result[parseInt(key)] = typeof value === 'number' ? value : 0
            })
            return result
        }
        // Convert from legacy workDays + dailyTarget
        const result: Record<number, number> = {}
        const defaultHours = user.dailyTarget || 8
        if (user.workDays && user.workDays.length > 0) {
            user.workDays.forEach(day => {
                result[day] = defaultHours
            })
        }
        return result
    }

    const [editWeeklyHours, setEditWeeklyHours] = useState<Record<number, number>>({})
    const [editSelectedDays, setEditSelectedDays] = useState<number[]>([])

    const [secondaryManagers, setSecondaryManagers] = useState<Array<{
        managerId: string
        manager: {
            id: string
            name: string
            email: string
        }
        permissions: string[]
    }>>([])
    const [loadingSecondary, setLoadingSecondary] = useState(false)

    // Role change dialog state
    const [roleDialogUser, setRoleDialogUser] = useState<User | null>(null)
    const [selectedRole, setSelectedRole] = useState<string>("")
    const [savingRole, setSavingRole] = useState(false)

    // Delete dialog state
    const [deleteDialogUser, setDeleteDialogUser] = useState<User | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [showTransferAdmin, setShowTransferAdmin] = useState(false)
    const [newAdminId, setNewAdminId] = useState<string>("")
    const [directReportsCount, setDirectReportsCount] = useState(0)
    const [replacementManagerId, setReplacementManagerId] = useState<string>("")

    // Manager edit dialog state
    const [showManagerDialog, setShowManagerDialog] = useState(false)

    // Primary Manager edit state (for saving when clicking main Save button)
    const [savingAll, setSavingAll] = useState(false)

    // Chief type edit state
    const [showChiefTypeDialog, setShowChiefTypeDialog] = useState(false)
    const [selectedChiefType, setSelectedChiefType] = useState<'partner' | 'independent' | null>(null)
    const [savingChiefType, setSavingChiefType] = useState(false)

    // Pending changes from AssignManagerDialog
    const [pendingManagerId, setPendingManagerId] = useState<string | undefined>(undefined)
    const [pendingChiefType, setPendingChiefType] = useState<'partner' | 'independent' | null | undefined>(undefined)

    const daysOfWeek = [
        { value: 0, label: t('days.sunday') },
        { value: 1, label: t('days.monday') },
        { value: 2, label: t('days.tuesday') },
        { value: 3, label: t('days.wednesday') },
        { value: 4, label: t('days.thursday') },
        { value: 5, label: t('days.friday') },
        { value: 6, label: t('days.saturday') },
    ]

    const openDialog = async (user: User) => {
        // Employees cannot edit settings
        if (currentUserRole === 'EMPLOYEE') return

        // Allow opening dialog for yourself
        if (user.id === currentUserId) {
            setSelectedUser(user)
            const hours = getWeeklyHoursFromLegacy(user)
            setEditWeeklyHours(hours)
            setEditSelectedDays(Object.keys(hours).map(Number).filter(day => hours[day] > 0))
            setLoadingSecondary(false)
            return
        }

        // Check if current user can manage this user (permissions check)
        // Only allow opening dialog for users in hierarchy or below
        if (allUsers) {
            const currentUserData = allUsers.find(u => u.id === currentUserId)
            if (currentUserData) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const canManage = canManageUser(currentUserData as any, user as any, allUsers as any)
                if (!canManage) {
                    // User cannot manage this person - don't open dialog
                    toast.error("You don't have permission to manage this user")
                    return
                }
            }
        }

        setSelectedUser(user)
        const hours = getWeeklyHoursFromLegacy(user)
        setEditWeeklyHours(hours)
        setEditSelectedDays(Object.keys(hours).map(Number).filter(day => hours[day] > 0))
        setPendingSecondaryManagers(null)

        // Fetch secondary managers
        setLoadingSecondary(true)
        try {
            const res = await fetch(`/api/team/hierarchy`)
            if (res.ok) {
                const data = await res.json()
                const foundUser = data.users.find((u: User & {
                    secondaryManagers: Array<{ managerId: string; permissions: string[] }>
                    sharedChiefGroupId?: string | null
                }) => u.id === user.id)
                setSecondaryManagers(foundUser?.secondaryManagers || [])
                // Set chief type based on sharedChiefGroupId
                if (foundUser && foundUser.role === 'ADMIN' && !foundUser.managerId) {
                    setSelectedChiefType(foundUser.sharedChiefGroupId ? 'partner' : 'independent')
                } else {
                    setSelectedChiefType(null)
                }
            }
        } catch (error) {
            console.error("Failed to fetch secondary managers", error)
        } finally {
            setLoadingSecondary(false)
        }
    }

    const closeDialog = () => {
        setSelectedUser(null)
        setEditWeeklyHours({})
        setEditSelectedDays([])
        setShowManagerDialog(false)
        setShowChiefTypeDialog(false)
        setSelectedChiefType(null)
        setPendingSecondaryManagers([])
        setPendingManagerId(undefined)
        setPendingChiefType(undefined)
    }

    const handleSaveChiefType = async () => {
        if (!selectedUser || !selectedChiefType) return

        setSavingChiefType(true)
        try {
            const res = await fetch("/api/team/chief-type", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: selectedUser.id,
                    chiefType: selectedChiefType
                })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.message || "Failed to update chief type")
            }

            router.refresh()
            setShowChiefTypeDialog(false)
            // Refresh the dialog to show updated data
            if (selectedUser) {
                openDialog(selectedUser)
            }
        } catch (error) {
            alert(error instanceof Error ? error.message : "Error updating chief type")
        } finally {
            setSavingChiefType(false)
        }
    }

    // const openRoleDialog = (user: User, e: React.MouseEvent) => {
    //     e.stopPropagation()
    //     setRoleDialogUser(user)
    //     setSelectedRole(user.role)
    // }

    const closeRoleDialog = () => {
        setRoleDialogUser(null)
        setSelectedRole("")
    }

    const openDeleteDialog = (user: User) => {
        setDeleteDialogUser(user)
        setShowTransferAdmin(false)
        setNewAdminId("")

        // Check for direct reports
        if (allUsers) {
            const count = allUsers.filter(u => u.managerId === user.id).length
            setDirectReportsCount(count)
        } else {
            // Fallback to local users if allUsers not provided (though it should be for accurate count)
            const count = users.filter(u => u.managerId === user.id).length
            setDirectReportsCount(count)
        }
        setReplacementManagerId("")
    }

    const closeDeleteDialog = () => {
        setDeleteDialogUser(null)
        setShowTransferAdmin(false)
        setNewAdminId("")
        setDirectReportsCount(0)
        setReplacementManagerId("")
    }

    const deleteUser = async () => {
        if (!deleteDialogUser) return

        setDeleting(true)
        try {
            const res = await fetch("/api/team/delete", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: deleteDialogUser.id,
                    newAdminId: showTransferAdmin ? newAdminId : undefined,
                    replacementManagerId: directReportsCount > 0 && replacementManagerId ? replacementManagerId : undefined
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                // Check if we need to transfer admin
                if (data.requiresAdminTransfer) {
                    setShowTransferAdmin(true)
                    setDeleting(false)
                    return
                }
                throw new Error(data.message || "Failed to remove user from team")
            }

            // Optimistic update
            setLocalUsers(prev => prev.filter(u => u.id !== deleteDialogUser.id))

            router.refresh()
            closeDeleteDialog()
        } catch (error) {
            alert(error instanceof Error ? error.message : "Error removing user from team")
        } finally {
            setDeleting(false)
        }
    }

    const saveRole = async () => {
        if (!roleDialogUser) return

        setSavingRole(true)
        try {
            const res = await fetch("/api/team/role", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: roleDialogUser.id,
                    role: selectedRole
                }),
            })
            if (!res.ok) throw new Error("Failed to update")
            router.refresh()
            closeRoleDialog()
        } catch {
            alert("Error updating role")
        } finally {
            setSavingRole(false)
        }
    }



    // Store pending secondary managers changes (will be saved when clicking main Save button)
    const [pendingSecondaryManagers, setPendingSecondaryManagers] = useState<Array<{ managerId: string; permissions: string[] }> | null>(null)

    const handleSaveSecondaryManagers = async (managers: Array<{ managerId: string; permissions: string[] }>) => {
        // Just update the state, don't save yet
        setPendingSecondaryManagers(managers)
    }

    const handleSaveAll = async () => {
        if (!selectedUser) return

        setSavingAll(true)

        try {
            // 1. Save Work Settings
            // Check if there are changes to avoid unnecessary calls? For now just save.
            // Only send hours for selected days
            const weeklyHoursToSend: Record<number, number> = {}
            editSelectedDays.forEach(day => {
                if (editWeeklyHours[day] && editWeeklyHours[day] > 0) {
                    weeklyHoursToSend[day] = editWeeklyHours[day]
                }
            })

            const workSettingsRes = await fetch("/api/team/work-settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: selectedUser.id,
                    weeklyHours: weeklyHoursToSend
                }),
            })
            if (!workSettingsRes.ok) throw new Error("Failed to update work settings")

            // 2. Save Primary Manager if changed
            if (pendingManagerId !== undefined || pendingChiefType !== undefined) {
                const managerId = pendingManagerId !== undefined ? pendingManagerId : selectedUser.managerId
                const chiefType = pendingChiefType !== undefined ? pendingChiefType : null

                // Validate chief type if required
                if (!managerId && selectedUser.role === "ADMIN" && chiefType === null) {
                    // Check if we need chief type - only if current user is top-level admin
                    const currentUserData = allUsers?.find(u => u.id === currentUserId)
                    const isTopLevelAdmin = currentUserData?.role === "ADMIN" && !currentUserData?.managerId
                    if (isTopLevelAdmin) {
                        toast.error("Please select Chief Type (Partner or Independent) when removing manager from an ADMIN")
                        setSavingAll(false)
                        return
                    }
                }

                const res = await fetch("/api/team/assign-manager", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        employeeId: selectedUser.id,
                        managerId: managerId,
                        chiefType: chiefType || undefined
                    }),
                })

                if (!res.ok) {
                    const data = await res.json()
                    throw new Error(data.message || "Failed to assign manager")
                }
            }

            // 3. Save Secondary Managers
            // If pendingSecondaryManagers is null, it means no changes were made to secondary managers
            const managersToSave = pendingSecondaryManagers !== null ? pendingSecondaryManagers : secondaryManagers
            const newManagerIds = managersToSave.map(m => m.managerId)

            // Remove managers that are no longer selected
            for (const current of secondaryManagers) {
                if (!newManagerIds.includes(current.managerId)) {
                    const res = await fetch("/api/team/secondary-manager/remove", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            employeeId: selectedUser.id,
                            managerId: current.managerId
                        })
                    })
                    if (!res.ok) {
                        const error = await res.json()
                        throw new Error(error.message || "Failed to remove secondary manager")
                    }
                }
            }

            // Add or update managers
            for (const manager of managersToSave) {
                if (manager.permissions.length > 0) {
                    const res = await fetch("/api/team/secondary-manager/add", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            employeeId: selectedUser.id,
                            managerId: manager.managerId,
                            permissions: manager.permissions
                        })
                    })
                    if (!res.ok) {
                        const error = await res.json()
                        throw new Error(error.message || "Failed to add/update secondary manager")
                    }
                }
            }

            // Close dialog and refresh
            closeDialog()
            router.refresh()
            toast.success("Settings saved successfully")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error saving settings")
        } finally {
            setSavingAll(false)
        }
    }



    const toggleDay = (day: number) => {
        setEditSelectedDays(prev => {
            const isSelected = prev.includes(day)
            const newSelected = isSelected
                ? prev.filter(d => d !== day).sort((a, b) => a - b)
                : [...prev, day].sort((a, b) => a - b)

            // Update weeklyHours: remove if unselected, add with default if selected
            setEditWeeklyHours(currentHours => {
                const updated = { ...currentHours }
                if (isSelected) {
                    delete updated[day]
                } else {
                    // Use existing hours if available, otherwise use default from first selected day or 8
                    const defaultHours = Object.values(currentHours)[0] || 8
                    updated[day] = defaultHours
                }
                return updated
            })

            return newSelected
        })
    }

    const updateDayHours = (day: number, hours: string) => {
        const hoursNum = hours === "" ? 0 : parseFloat(hours)
        if (isNaN(hoursNum) || hoursNum < 0) return

        setEditWeeklyHours(prev => {
            const updated = { ...prev }
            if (hoursNum === 0) {
                delete updated[day]
                // Remove from selected days if hours set to 0
                setEditSelectedDays(current => current.filter(d => d !== day))
            } else {
                updated[day] = hoursNum
                // Add to selected days if not already there
                setEditSelectedDays(current => {
                    if (!current.includes(day)) {
                        return [...current, day].sort((a, b) => a - b)
                    }
                    return current
                })
            }
            return updated
        })
    }



    if (localUsers.length === 0) {
        return <div className="text-center text-muted-foreground py-8">{t('team.noTeamMembersYet')}</div>
    }

    // Helper function to get job title
    const getJobTitle = (user: User) => {
        if (user.jobTitle) return user.jobTitle
        if (user.role === "ADMIN") return "Founder"
        return user.role.toLowerCase().replace('_', ' ')
    }

    return (
        <>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-2.5">
                {localUsers.map((user) => (
                    <Card
                        key={user.id}
                        className={`${currentUserRole !== 'EMPLOYEE' ? 'cursor-pointer hover:bg-muted/50 transition-all duration-200 hover:shadow-md' : ''} border-border/60 shadow-sm`}
                        onClick={() => openDialog(user)}
                    >
                        <CardContent className="p-4">
                            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <Avatar className="h-12 w-12 flex-shrink-0 ring-2 ring-background">
                                    <AvatarImage src={user.image || undefined} alt={user.name} />
                                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                        {user.name.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-semibold text-base truncate">
                                            {user.name}
                                        </h3>
                                        {user.id === currentUserId && (
                                            <span className="text-xs text-muted-foreground font-normal whitespace-nowrap">
                                                {t('common.you')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground truncate mb-1">
                                        {user.email}
                                    </p>
                                    <p className="text-xs text-muted-foreground capitalize">
                                        {getJobTitle(user)}
                                    </p>
                                </div>
                                {currentUserRole !== 'EMPLOYEE' && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            openDeleteDialog(user)
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className={`w-[80px] ${isRTL ? 'text-right' : 'text-left'}`}>{t('team.profile')}</TableHead>
                            <TableHead className={isRTL ? 'text-right' : 'text-left'}>{t('team.name')}</TableHead>
                            <TableHead className={isRTL ? 'text-right' : 'text-left'}>{t('team.email')}</TableHead>
                            <TableHead className={isRTL ? 'text-right' : 'text-left'}>{t('team.jobTitle')}</TableHead>
                            <TableHead className={isRTL ? 'text-left' : 'text-right'}>{t('team.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {localUsers.map((user) => (
                            <TableRow
                                key={user.id}
                                className={`${currentUserRole !== 'EMPLOYEE' ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                                onClick={() => openDialog(user)}
                            >
                                <TableCell className={isRTL ? 'text-right' : 'text-left'}>
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={user.image || undefined} alt={user.name} />
                                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                            {user.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                </TableCell>
                                <TableCell className={`font-bold ${isRTL ? 'text-right' : 'text-left'}`}>
                                    {user.name} {user.id === currentUserId && <span className="text-muted-foreground font-normal">{t('common.you')}</span>}
                                </TableCell>
                                <TableCell className={isRTL ? 'text-right' : 'text-left'}>{user.email}</TableCell>
                                <TableCell className={isRTL ? 'text-right' : 'text-left'}>
                                    <span className="capitalize">
                                        {getJobTitle(user)}
                                    </span>
                                </TableCell>
                                <TableCell className={isRTL ? 'text-left' : 'text-right'} onClick={(e) => e.stopPropagation()}>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => openDeleteDialog(user)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Team Member Settings Dialog */}
            <Dialog open={!!selectedUser} onOpenChange={(open) => !open && closeDialog()}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto [&>button]:left-4 [&>button]:right-auto" dir={isRTL ? 'rtl' : 'ltr'}>
                    <DialogHeader className={isRTL ? 'text-right' : 'text-left'}>
                        <DialogTitle className={isRTL ? 'text-right' : 'text-left'}>{t('team.teamMemberSettings')} - {selectedUser?.name}</DialogTitle>
                        <DialogDescription className={isRTL ? 'text-right' : 'text-left'}>
                            {t('team.manageWorkSettings')}
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="work" className="mt-4">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="work">{t('team.workSettings')}</TabsTrigger>
                            <TabsTrigger value="managers">{t('team.managers')}</TabsTrigger>
                        </TabsList>

                        <TabsContent value="work" className="space-y-6 pt-4">
                            <div className="space-y-4">
                                <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
                                    <div className="space-y-1">
                                        <Label className={`block ${isRTL ? 'text-right' : 'text-left'}`}>{t('preferences.workDays')}</Label>
                                        <p className={`text-xs text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                                            {t('team.selectWorkDaysMember') || 'Configure work days and targets.'}
                                        </p>
                                    </div>

                                    {/* Quick Actions */}
                                    <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const standardDays = [0, 1, 2, 3, 4]; // Sun-Thu
                                                setEditSelectedDays(standardDays);
                                                setEditWeeklyHours(prev => {
                                                    const updated = { ...prev };
                                                    standardDays.forEach(d => {
                                                        if (!updated[d]) updated[d] = 8;
                                                    });
                                                    return updated;
                                                });
                                            }}
                                            className="text-xs h-8 px-2"
                                        >
                                            Sun-Thu
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                const standardDays = [1, 2, 3, 4, 5]; // Mon-Fri
                                                setEditSelectedDays(standardDays);
                                                setEditWeeklyHours(prev => {
                                                    const updated = { ...prev };
                                                    standardDays.forEach(d => {
                                                        if (!updated[d]) updated[d] = 8;
                                                    });
                                                    return updated;
                                                });
                                            }}
                                            className="text-xs h-8 px-2"
                                        >
                                            Mon-Fri
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setEditSelectedDays([]);
                                                setEditWeeklyHours({});
                                            }}
                                            className="text-xs h-8 px-2 text-muted-foreground hover:text-destructive"
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {daysOfWeek.map(day => {
                                        const isSelected = editSelectedDays.includes(day.value);
                                        return (
                                            <div
                                                key={day.value}
                                                className={`flex items-center justify-between p-3 rounded-md border transition-all ${isSelected ? 'bg-primary/5 border-primary/20' : 'bg-transparent border-transparent hover:bg-muted/50'} ${isRTL ? 'flex-row-reverse' : ''}`}
                                            >
                                                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                                    <Switch
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleDay(day.value)}
                                                        id={`day-switch-${day.value}`}
                                                    />
                                                    <Label
                                                        htmlFor={`day-switch-${day.value}`}
                                                        className={`font-medium cursor-pointer ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}
                                                    >
                                                        {day.label}
                                                    </Label>
                                                </div>

                                                {isSelected && (
                                                    <div className={`flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                                        <Input
                                                            type="number"
                                                            step="0.5"
                                                            min="0"
                                                            value={editWeeklyHours[day.value]?.toString() || ""}
                                                            onChange={e => updateDayHours(day.value, e.target.value)}
                                                            placeholder="8"
                                                            className="w-16 h-7 text-center text-sm px-1"
                                                            dir="ltr"
                                                            onKeyDown={(e) => {
                                                                if (e.key === '-' || e.key === 'Minus') {
                                                                    e.preventDefault()
                                                                }
                                                            }}
                                                        />
                                                        <span className="text-[10px] text-muted-foreground">{t('preferences.hours') || 'h'}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="managers" className="pt-4">
                            {loadingSecondary ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : selectedUser ? (
                                <div className="space-y-6">
                                    {/* Primary Manager(s) Section */}
                                    <div className="space-y-3">
                                        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                                            <Label className={`text-base font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{t('team.primaryManagers')}</Label>
                                            {selectedUser && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setShowManagerDialog(true)}
                                                    className="h-8"
                                                >
                                                    <Edit className={`h-3 w-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                                    {t('common.edit')}
                                                </Button>
                                            )}
                                        </div>
                                        <div className="p-4 border rounded-lg bg-muted/30">
                                            {(() => {
                                                // Use allUsers if available, otherwise fall back to users
                                                const searchUsers = allUsers || users

                                                // Check if the user has a direct manager (managerId)
                                                if (selectedUser.managerId) {
                                                    // Find the direct manager in all users (not just visible ones)
                                                    const directManager = searchUsers.find(u => u.id === selectedUser.managerId)

                                                    if (!directManager) {
                                                        // Manager not found in project
                                                        return (
                                                            <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                                                                {t('team.managerNotFound')}
                                                            </p>
                                                        )
                                                    }

                                                    // If the direct manager is an ADMIN with sharedChiefGroupId, show all chiefs in that group
                                                    const directManagerWithExtras = directManager as User & { sharedChiefGroupId?: string | null }
                                                    if (directManager.role === 'ADMIN' && directManagerWithExtras.sharedChiefGroupId) {
                                                        const sharedGroupId = directManagerWithExtras.sharedChiefGroupId
                                                        // Find all chiefs in the same shared group (all should be ADMINs with no manager)
                                                        const allSharedChiefs = searchUsers.filter(u => {
                                                            const uWithExtras = u as User & { sharedChiefGroupId?: string | null }
                                                            return u.role === 'ADMIN' &&
                                                                uWithExtras.sharedChiefGroupId === sharedGroupId &&
                                                                !u.managerId
                                                        })

                                                        if (allSharedChiefs.length > 0) {
                                                            return (
                                                                <div className="space-y-2">
                                                                    <p className={`text-xs text-muted-foreground mb-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                                                                        {t('team.reportsToSharedGroup')}
                                                                    </p>
                                                                    {allSharedChiefs.map(chief => (
                                                                        <div key={chief.id} className={`flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                                                            <Avatar className="h-10 w-10">
                                                                                <AvatarImage src={chief.image || undefined} alt={chief.name} />
                                                                                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                                                                    {chief.name.substring(0, 2).toUpperCase()}
                                                                                </AvatarFallback>
                                                                            </Avatar>
                                                                            <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                                                                                <h4 className="font-semibold">{chief.name}</h4>
                                                                                <p className="text-sm text-muted-foreground">{chief.email}</p>
                                                                                {chief.jobTitle && (
                                                                                    <p className="text-xs text-muted-foreground capitalize mt-0.5">
                                                                                        {chief.jobTitle}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )
                                                        }
                                                    }

                                                    // Otherwise, show the single direct manager
                                                    return (
                                                        <div className={`flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                                            <Avatar className="h-10 w-10">
                                                                <AvatarImage src={directManager.image || undefined} alt={directManager.name} />
                                                                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                                                    {directManager.name.substring(0, 2).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                                                                <h4 className="font-semibold">{directManager.name}</h4>
                                                                <p className="text-sm text-muted-foreground">{directManager.email}</p>
                                                                {directManager.jobTitle && (
                                                                    <p className="text-xs text-muted-foreground capitalize mt-0.5">
                                                                        {directManager.jobTitle}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                }

                                                // No managerId - user has no direct manager
                                                const isTopLevelChief = selectedUser.role === 'ADMIN' && !selectedUser.managerId

                                                return (
                                                    <div className="space-y-3">
                                                        <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                                                            {t('team.noPrimaryManager')}
                                                        </p>
                                                        {isTopLevelChief && (
                                                            <div className="space-y-2">
                                                                <Label className={`text-sm font-medium ${isRTL ? 'text-right' : 'text-left'}`}>
                                                                    Chief Type
                                                                </Label>
                                                                <div className="flex gap-2">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => setShowChiefTypeDialog(true)}
                                                                        className="flex-1"
                                                                    >
                                                                        <Edit className={`h-3 w-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                                                                        {selectedChiefType === 'partner' ? 'Partner' : selectedChiefType === 'independent' ? 'Independent' : 'Set Chief Type'}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })()}
                                        </div>
                                    </div>

                                    {/* Secondary Managers Section */}
                                    <div className="space-y-3">
                                        <Label className={`text-base font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{t('team.secondaryManagers')}</Label>
                                        <SecondaryManagersForm
                                            employeeId={selectedUser.id}
                                            currentSecondaryManagers={secondaryManagers}
                                            availableManagers={users.filter(u => u.role === 'ADMIN' || u.role === 'MANAGER')}
                                            onSave={handleSaveSecondaryManagers}
                                            hideSaveButton={true}
                                        />
                                    </div>
                                </div>
                            ) : null}
                        </TabsContent>
                    </Tabs>

                    {/* Save Button */}
                    {selectedUser && (
                        <DialogFooter>
                            <Button variant="outline" onClick={closeDialog}>
                                {t('common.cancel')}
                            </Button>
                            <Button onClick={handleSaveAll} disabled={savingAll}>
                                {savingAll && <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />}
                                {t('common.save')}
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>

            {/* Role Change Dialog */}
            <Dialog open={!!roleDialogUser} onOpenChange={(open) => !open && closeRoleDialog()}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Change Role - {roleDialogUser?.name}</DialogTitle>
                        <DialogDescription>
                            Select a new role for this team member.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Select value={selectedRole} onValueChange={setSelectedRole}>
                                <SelectTrigger id="role">
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ADMIN">Admin</SelectItem>
                                    <SelectItem value="MANAGER">Manager</SelectItem>
                                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                <strong>Admin:</strong> Full access to all features<br />
                                <strong>Manager:</strong> Can manage team members<br />
                                <strong>Employee:</strong> Basic access
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeRoleDialog} disabled={savingRole}>
                            Cancel
                        </Button>
                        <Button onClick={saveRole} disabled={savingRole}>
                            {savingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Role
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manager Edit Dialog */}
            {selectedUser && (
                <AssignManagerDialog
                    open={showManagerDialog}
                    onOpenChange={(open) => {
                        setShowManagerDialog(open)
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    employee={selectedUser as any}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    managers={users.filter(u => u.id !== selectedUser.id && (u.role === 'ADMIN' || u.role === 'MANAGER')) as any}
                    onManagerChange={(managerId, chiefType) => {
                        setPendingManagerId(managerId === null ? "none" : managerId)
                        setPendingChiefType(chiefType)
                        setShowManagerDialog(false)
                    }}
                />
            )}

            {/* Chief Type Edit Dialog */}
            <Dialog open={showChiefTypeDialog} onOpenChange={setShowChiefTypeDialog}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Set Chief Type</DialogTitle>
                        <DialogDescription>
                            Select how this chief should be configured in the organization
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid gap-3">
                            {/* Option 1: Partner */}
                            <Card
                                className={cn(
                                    "p-4 cursor-pointer border-2 transition-all hover:border-primary/50",
                                    selectedChiefType === "partner"
                                        ? "border-primary bg-primary/5"
                                        : "border-border"
                                )}
                                onClick={() => setSelectedChiefType("partner")}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={cn(
                                        "mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                                        selectedChiefType === "partner"
                                            ? "border-primary bg-primary"
                                            : "border-muted-foreground"
                                    )}>
                                        {selectedChiefType === "partner" && (
                                            <Check className="h-3 w-3 text-primary-foreground" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-sm mb-1">
                                            Partner – Shared Leadership
                                        </h4>
                                        <p className="text-sm text-muted-foreground mb-2">
                                            This chief will act as a shared manager together with other chiefs in the same group. All chiefs in the group behave as a single logical entity.
                                        </p>
                                    </div>
                                </div>
                            </Card>

                            {/* Option 2: Independent */}
                            <Card
                                className={cn(
                                    "p-4 cursor-pointer border-2 transition-all hover:border-primary/50",
                                    selectedChiefType === "independent"
                                        ? "border-primary bg-primary/5"
                                        : "border-border"
                                )}
                                onClick={() => setSelectedChiefType("independent")}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={cn(
                                        "mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                                        selectedChiefType === "independent"
                                            ? "border-primary bg-primary"
                                            : "border-muted-foreground"
                                    )}>
                                        {selectedChiefType === "independent" && (
                                            <Check className="h-3 w-3 text-primary-foreground" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-sm mb-1">
                                            Independent Chief – Separate Branch
                                        </h4>
                                        <p className="text-sm text-muted-foreground mb-2">
                                            This chief will be a separate top-level manager with their own hierarchy.
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowChiefTypeDialog(false)} disabled={savingChiefType}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveChiefType} disabled={savingChiefType || !selectedChiefType}>
                            {savingChiefType && <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteDialogUser} onOpenChange={(open) => !open && closeDeleteDialog()}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>
                            {directReportsCount > 0 ? "ARE YOU SURE YOU WANT TO DELETE THIS MANAGER?" : "Remove User from Team"}
                        </DialogTitle>
                        <DialogDescription>
                            {showTransferAdmin ? (
                                <>Select a new admin before removing <strong>{deleteDialogUser?.name}</strong> from the team</>
                            ) : directReportsCount > 0 ? (
                                <span className="text-destructive font-medium block mt-2">
                                    This user has <strong>{directReportsCount}</strong> direct reports. Deleting them will leave these reports without a manager.
                                    You can transfer them to another manager below, or they will be left unassigned (orphaned).
                                </span>
                            ) : (
                                <>Are you sure you want to remove <strong>{deleteDialogUser?.name}</strong> from the team? They will be removed from the team but their account will remain active.</>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {showTransferAdmin ? (
                        <div className="space-y-4 pt-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                                <p className="text-sm text-amber-800">
                                    ⚠️ You are the only admin. Please select a new admin before proceeding.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="newAdmin">Transfer Admin To</Label>
                                <Select value={newAdminId} onValueChange={setNewAdminId}>
                                    <SelectTrigger id="newAdmin">
                                        <SelectValue placeholder="Select user" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users
                                            .filter(u => u.id !== deleteDialogUser?.id)
                                            .map(u => (
                                                <SelectItem key={u.id} value={u.id}>
                                                    {u.name} ({u.email})
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    ) : (
                        <div className="pt-4 space-y-4">
                            {directReportsCount > 0 && (
                                <div className="space-y-3 p-4 border rounded-md bg-muted/30">
                                    <Label htmlFor="replacementManager">
                                        Transfer Direct Reports To (Optional)
                                    </Label>
                                    <Select value={replacementManagerId} onValueChange={setReplacementManagerId}>
                                        <SelectTrigger id="replacementManager">
                                            <SelectValue placeholder="Select replacement manager" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {/* Show only potential managers (Admins/Managers) who are NOT the user being deleted */}
                                            {users
                                                .filter(u =>
                                                    u.id !== deleteDialogUser?.id &&
                                                    (u.role === 'ADMIN' || u.role === 'MANAGER')
                                                )
                                                .map(u => (
                                                    <SelectItem key={u.id} value={u.id}>
                                                        {u.name} - {u.role}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        If you don&apos;t select a replacement, the {directReportsCount} reports will be left without a direct manager.
                                    </p>
                                </div>
                            )}

                            {!directReportsCount && (
                                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                                    <p className="text-sm text-blue-900 dark:text-blue-100">
                                        ℹ️ The user will be removed from the team and will no longer appear in the team list or hierarchy. Their account will remain active.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={closeDeleteDialog} disabled={deleting}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={deleteUser}
                            disabled={deleting || (showTransferAdmin && !newAdminId)}
                        >
                            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {showTransferAdmin ? "Transfer & Remove" :
                                directReportsCount > 0
                                    ? (replacementManagerId ? "Transfer & Delete Manager" : "Delete Manager (Orphan Reports)")
                                    : "Remove from Team"
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
