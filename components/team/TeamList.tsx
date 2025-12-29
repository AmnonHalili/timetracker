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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SecondaryManagersForm } from "./SecondaryManagersForm"
import { AssignManagerDialog } from "./AssignManagerDialog"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2, Edit, Check } from "lucide-react"
import { useLanguage } from "@/lib/useLanguage"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface User {
    id: string
    name: string
    email: string
    role: string
    status: string
    image: string | null
    dailyTarget: number | null
    workDays: number[]
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
    const [editTarget, setEditTarget] = useState<string>("")
    const [editDays, setEditDays] = useState<number[]>([])
    const [saving, setSaving] = useState(false)
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

    // Manager edit dialog state
    const [showManagerDialog, setShowManagerDialog] = useState(false)
    
    // Chief type edit state
    const [showChiefTypeDialog, setShowChiefTypeDialog] = useState(false)
    const [selectedChiefType, setSelectedChiefType] = useState<'partner' | 'independent' | null>(null)
    const [savingChiefType, setSavingChiefType] = useState(false)

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

        setSelectedUser(user)
        setEditTarget(user.dailyTarget?.toString() || "")
        setEditDays(user.workDays || [])

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
        setEditTarget("")
        setEditDays([])
        setShowManagerDialog(false)
        setShowChiefTypeDialog(false)
        setSelectedChiefType(null)
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
    }

    const closeDeleteDialog = () => {
        setDeleteDialogUser(null)
        setShowTransferAdmin(false)
        setNewAdminId("")
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
                    newAdminId: showTransferAdmin ? newAdminId : undefined
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
                throw new Error(data.message || "Failed to delete")
            }

            // Optimistic update
            setLocalUsers(prev => prev.filter(u => u.id !== deleteDialogUser.id))

            router.refresh()
            closeDeleteDialog()
        } catch (error) {
            alert(error instanceof Error ? error.message : "Error deleting user")
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

    const saveEdit = async () => {
        if (!selectedUser) return

        setSaving(true)
        try {
            const res = await fetch("/api/team/work-settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: selectedUser.id,
                    dailyTarget: editTarget === "" ? null : parseFloat(editTarget),
                    workDays: editDays
                }),
            })
            if (!res.ok) throw new Error("Failed to update")
            router.refresh()
            closeDialog()
        } catch {
            alert("Error updating work settings")
        } finally {
            setSaving(false)
        }
    }

    const handleSaveSecondaryManagers = async (managers: Array<{ managerId: string; permissions: string[] }>) => {
        if (!selectedUser) return

        try {
            // Get current secondary managers to determine what to add/remove
            const newManagerIds = managers.map(m => m.managerId)

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
            for (const manager of managers) {
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

            // Close dialog first
            closeDialog()
            
            // Refresh the page to update the team list (this will re-filter users based on new secondary manager relationships)
            router.refresh()
            
            // Show success message
            alert(t('team.secondaryManagersUpdated') || "Secondary managers updated successfully")
        } catch (error) {
            console.error("Error updating secondary managers:", error)
            alert(error instanceof Error ? error.message : (t('team.errorUpdatingSecondaryManagers') || "Error updating secondary managers"))
            throw error
        }
    }



    const toggleDay = (day: number) => {
        setEditDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b)
        )
    }



    if (localUsers.length === 0) {
        return <div className="text-center text-muted-foreground py-8">{t('team.noTeamMembersYet')}</div>
    }

    return (
        <>
            <div className="rounded-md border">
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
                                        {(() => {
                                            // If user has a jobTitle, use it
                                            if (user.jobTitle) return user.jobTitle
                                            // Default to "Founder" for ADMIN users with a team
                                            if (user.role === "ADMIN") return "Founder"
                                            // Otherwise fall back to role
                                            return user.role.toLowerCase().replace('_', ' ')
                                        })()}
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
                            <div className="space-y-3">
                                <Label className={`block ${isRTL ? 'text-right' : 'text-left'}`}>{t('preferences.workDays')}</Label>
                                <p className={`text-xs text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                                    {t('team.selectWorkDaysMember')}
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {daysOfWeek.map(day => (
                                        <button
                                            key={day.value}
                                            type="button"
                                            onClick={() => toggleDay(day.value)}
                                            className={`px-4 py-3 rounded-md text-sm font-medium transition-colors ${editDays.includes(day.value)
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                                                }`}
                                        >
                                            {day.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="target" className={`block ${isRTL ? 'text-right' : 'text-left'}`}>{t('team.dailyTargetHours')}</Label>
                                <Input
                                    id="target"
                                    type="number"
                                    step="0.5"
                                    value={editTarget}
                                    onChange={e => setEditTarget(e.target.value)}
                                    dir="ltr"
                                />
                                <p className={`text-xs text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                                    {t('team.dailyTargetDescription')}
                                </p>
                            </div>

                            <div className={`flex pt-4 border-t ${isRTL ? 'justify-start' : 'justify-end'}`}>
                                <Button onClick={saveEdit} disabled={saving}>
                                    {saving && <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />}
                                    {t('team.saveWorkSettings')}
                                </Button>
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
                                                const selectedUserWithExtras = selectedUser as User & { sharedChiefGroupId?: string | null }
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
                                        />
                                    </div>
                                </div>
                            ) : null}
                        </TabsContent>
                    </Tabs>
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
                        if (!open && selectedUser) {
                            // Refresh user data after manager change
                            openDialog(selectedUser)
                        }
                    }}
                    employee={selectedUser as any}
                    managers={users.filter(u => u.id !== selectedUser.id && (u.role === 'ADMIN' || u.role === 'MANAGER'))}
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
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Delete User</DialogTitle>
                        <DialogDescription>
                            {showTransferAdmin ? (
                                <>Select a new admin before deleting <strong>{deleteDialogUser?.name}</strong></>
                            ) : (
                                <>Are you sure you want to delete <strong>{deleteDialogUser?.name}</strong>? This action cannot be undone.</>
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
                        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4 mt-4">
                            <p className="text-sm text-destructive">
                                ⚠️ All time entries and data associated with this user will be permanently deleted.
                            </p>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={closeDeleteDialog} disabled={deleting}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={deleteUser}
                            disabled={deleting || (showTransferAdmin && !newAdminId)}
                        >
                            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {showTransferAdmin ? "Transfer & Delete" : "Delete User"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
