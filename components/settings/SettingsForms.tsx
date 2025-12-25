"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import { useState, useRef } from "react"
import { User, Upload, Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { signOut, useSession } from "next-auth/react"

interface ProfileFormProps {
    user: {
        name: string
        email: string
        image?: string | null
        jobTitle?: string | null
        role: string
        projectId?: string | null
    }
}

function ProfileForm({ user }: ProfileFormProps) {
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState(user.name)
    const [image, setImage] = useState(user.image || "")
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    // Calculate default job title based on user role and team status
    // Default to "Founder" for ADMIN users who created a team, "single" for members without a team
    const getDefaultJobTitle = () => {
        // If user already has a jobTitle, use it
        if (user.jobTitle) return user.jobTitle
        // Default to "Founder" for ADMIN users with a team (team creators)
        if (user.role === "ADMIN" && user.projectId) return "Founder"
        // Default to "single" for member users without a team
        if (user.role !== "ADMIN" && !user.projectId) return "single"
        // For other cases (members with a team), return empty string (no default)
        return ""
    }

    const [jobTitle, setJobTitle] = useState(getDefaultJobTitle())

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (file.size > 1024 * 1024) { // 1MB limit for Base64
                alert("Image too large. Please use an image under 1MB.")
                return
            }
            const reader = new FileReader()
            reader.onloadend = () => {
                setImage(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, image, jobTitle: jobTitle || null }),
            })
            if (!res.ok) throw new Error("Failed to update")
            router.refresh()
            alert("Profile updated!")
        } catch {
            alert("Error updating profile")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your public profile details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex flex-col items-center gap-4">
                    <div
                        className="w-24 h-24 rounded-full bg-muted border-2 border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden relative group cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {image ? (
                            <Image src={image} alt="Profile" fill className="object-cover" />
                        ) : (
                            <User className="h-8 w-8 text-muted-foreground" />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Upload className="h-6 w-6 text-white" />
                        </div>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                        aria-label="Upload profile picture"
                    />
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} aria-label="Change profile picture">
                        Change Picture
                    </Button>
                </div>

                <div className="space-y-1">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={user.email} disabled className="bg-muted" />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="name">Display Name</Label>
                    <Input id="name" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="jobTitle">Job Title</Label>
                    <Input
                        id="jobTitle"
                        value={jobTitle}
                        onChange={e => setJobTitle(e.target.value)}
                        placeholder="Enter your job title"
                    />
                </div>
            </CardContent>
            <CardFooter>
                <Button onClick={handleSubmit} disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </CardFooter>
        </Card>
    )
}

interface SecurityFormProps {
    user: {
        role: string
        projectId: string | null
    }
}

function SecurityForm({ user }: SecurityFormProps) {
    const { data: session } = useSession()

    const [loading, setLoading] = useState(false)
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")

    // Delete account state
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [requiresAdminTransfer, setRequiresAdminTransfer] = useState(false)
    const [newAdminId, setNewAdminId] = useState("")
    const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string; email: string }>>([])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (newPassword !== confirmPassword) {
            alert("New passwords do not match")
            return
        }
        setLoading(true)
        try {
            const res = await fetch("/api/user/password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message)

            setCurrentPassword("")
            setNewPassword("")
            setConfirmPassword("")
            alert("Password changed successfully")
        } catch (error) {
            alert(error instanceof Error ? error.message : "Error updating password")
        } finally {
            setLoading(false)
        }
    }

    // Fetch team members if user is admin and needs to transfer
    const fetchTeamMembers = async () => {
        if (user.role === "ADMIN" && user.projectId) {
            try {
                const res = await fetch("/api/team")
                if (res.ok) {
                    const members = await res.json()
                    // Filter out current user
                    if (session?.user?.id) {
                        setTeamMembers(members.filter((m: { id: string }) => m.id !== session.user.id))
                    } else {
                        setTeamMembers(members)
                    }
                }
            } catch (error) {
                console.error("Failed to fetch team members:", error)
            }
        }
    }

    const handleDeleteClick = () => {
        setIsDeleteDialogOpen(true)
        if (user.role === "ADMIN" && user.projectId) {
            fetchTeamMembers()
        }
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            const res = await fetch("/api/user/delete", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    newAdminId: requiresAdminTransfer ? newAdminId : undefined
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                // Check if we need to transfer admin
                if (data.requiresAdminTransfer) {
                    setRequiresAdminTransfer(true)
                    setIsDeleting(false)
                    return
                }
                throw new Error(data.message || "Failed to delete account")
            }

            // Sign out and redirect to login
            await signOut({ callbackUrl: "/login" })
        } catch (error) {
            alert(error instanceof Error ? error.message : "Error deleting account")
            setIsDeleting(false)
        }
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Security</CardTitle>
                    <CardDescription>Manage your password and account security.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="current">Current Password</Label>
                            <Input id="current" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="new">New Password</Label>
                            <Input id="new" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="confirm">Confirm New Password</Label>
                            <Input id="confirm" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                        </div>
                        <div className="pt-2">
                            <Button onClick={handleSubmit} disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Update Password
                            </Button>
                        </div>
                    </div>

                    {/* Delete Account Section */}
                    <div className="pt-6 border-t">
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-lg font-semibold text-destructive">Delete Account</h3>
                                <p className="text-sm text-muted-foreground">
                                    Permanently delete your account and all associated data. This action cannot be undone.
                                </p>
                            </div>
                            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
                                <p className="text-sm text-destructive">
                                    ⚠️ Warning: This will permanently delete your account, all your time entries, tasks, and other data.
                                </p>
                            </div>
                            <Button
                                variant="destructive"
                                onClick={handleDeleteClick}
                                className="gap-2"
                            >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                Delete My Account
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Delete Account Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Account</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete your account? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {requiresAdminTransfer && (
                        <div className="space-y-4 py-4">
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
                                        {teamMembers.map(member => (
                                            <SelectItem key={member.id} value={member.id}>
                                                {member.name} ({member.email})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting || (requiresAdminTransfer && !newAdminId)}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                    Deleting...
                                </>
                            ) : (
                                "Delete Account"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

function PreferencesForm({ user }: { user: { dailyTarget: number | null; workDays: number[]; workMode: 'OUTPUT_BASED' | 'TIME_BASED' | 'PROJECT_BASED'; role: string; projectId: string | null } }) {
    const [loading, setLoading] = useState(false)
    const [target, setTarget] = useState(user.dailyTarget?.toString() || "")
    const [selectedDays, setSelectedDays] = useState<number[]>(user.workDays || [])
    // Filter out PROJECT_BASED since it's deprecated, default to TIME_BASED
    const [workMode] = useState<'OUTPUT_BASED' | 'TIME_BASED'>(
        user.workMode === 'PROJECT_BASED' ? 'TIME_BASED' : user.workMode
    )
    const router = useRouter()

    const canEdit = !(user.role === 'EMPLOYEE' && user.projectId !== null)

    const daysOfWeek = [
        { value: 0, label: 'Sunday' },
        { value: 1, label: 'Monday' },
        { value: 2, label: 'Tuesday' },
        { value: 3, label: 'Wednesday' },
        { value: 4, label: 'Thursday' },
        { value: 5, label: 'Friday' },
        { value: 6, label: 'Saturday' },
    ]

    const toggleDay = (day: number) => {
        if (!canEdit) return
        setSelectedDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b)
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch("/api/user/preferences", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dailyTarget: target === "" ? null : parseFloat(target),
                    workDays: selectedDays,
                    workMode
                }),
            })
            if (!res.ok) throw new Error("Failed to update")
            router.refresh()
            alert("Preferences updated!")
        } catch {
            alert("Error updating preferences")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Work Preferences</CardTitle>
                <CardDescription>
                    {canEdit
                        ? "Set your daily work goals and schedule."
                        : "These settings are managed by your team admin."}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {!canEdit && (
                    <div className="bg-muted/50 p-4 rounded-lg border text-sm text-muted-foreground">
                        Your work schedule and targets are determined by your organization. Please contact your manager to request changes.
                    </div>
                )}
                <div className={!canEdit ? "opacity-60 pointer-events-none" : ""}>
                    <div className="space-y-3">
                        <Label>Work Days</Label>
                        <p className="text-xs text-muted-foreground">
                            Select the days you typically work.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {daysOfWeek.map(day => (
                                <button
                                    key={day.value}
                                    type="button"
                                    onClick={() => toggleDay(day.value)}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${selectedDays.includes(day.value)
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                                        }`}
                                >
                                    {day.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1 mt-6">
                        <Label htmlFor="target">Daily Target (Hours)</Label>
                        <Input
                            id="target"
                            type="number"
                            step="0.5"
                            value={target}
                            onChange={e => setTarget(e.target.value)}
                            disabled={!canEdit}
                        />
                        <p className="text-xs text-muted-foreground">
                            This is used to calculate your &quot;Remaining Hours&quot; for the day. Leave empty if you don&apos;t have a specific target.
                        </p>
                    </div>
                </div>
            </CardContent>
            {canEdit && (
                <CardFooter>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Preferences
                    </Button>
                </CardFooter>
            )}
        </Card>
    )
}

export { ProfileForm, SecurityForm, PreferencesForm }
