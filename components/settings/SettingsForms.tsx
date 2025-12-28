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

import { useState, useRef, useEffect } from "react"
import { User, Upload, Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { signOut, useSession } from "next-auth/react"
import { useLanguage } from "@/lib/useLanguage"
import { Language } from "@/lib/translations"

interface ProfileFormProps {
    user: {
        name: string
        email: string
        image?: string | null
        jobTitle?: string | null
        role: string
        projectId?: string | null
        dailyTarget?: number | null
        workDays?: number[]
        workMode?: 'OUTPUT_BASED' | 'TIME_BASED' | 'PROJECT_BASED'
    }
}

function ProfileForm({ user }: ProfileFormProps) {
    const { t, dir } = useLanguage()
    const [loading, setLoading] = useState(false)
    const [preferencesLoading, setPreferencesLoading] = useState(false)
    const [name, setName] = useState(user.name)
    const [image, setImage] = useState(user.image || "")
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    // Preferences state
    const [target, setTarget] = useState(user.dailyTarget?.toString() || "")
    const [selectedDays, setSelectedDays] = useState<number[]>(user.workDays || [])
    const [workMode] = useState<'OUTPUT_BASED' | 'TIME_BASED'>(
        user.workMode === 'PROJECT_BASED' ? 'TIME_BASED' : (user.workMode || 'TIME_BASED')
    )

    const canEditPreferences = !(user.role === 'EMPLOYEE' && user.projectId !== null)

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

    const daysOfWeek = [
        { value: 0, label: t('days.sunday') },
        { value: 1, label: t('days.monday') },
        { value: 2, label: t('days.tuesday') },
        { value: 3, label: t('days.wednesday') },
        { value: 4, label: t('days.thursday') },
        { value: 5, label: t('days.friday') },
        { value: 6, label: t('days.saturday') },
    ]

    const toggleDay = (day: number) => {
        if (!canEditPreferences) return
        setSelectedDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b)
        )
    }

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
            alert(t('profile.updated'))
        } catch {
            alert(t('common.error'))
        } finally {
            setLoading(false)
        }
    }

    const handlePreferencesSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setPreferencesLoading(true)
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
            alert(t('preferences.updated'))
        } catch {
            alert(t('common.error'))
        } finally {
            setPreferencesLoading(false)
        }
    }

    return (
        <div className="space-y-6" dir={dir}>
            {/* Profile Information Card */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('profile.title')}</CardTitle>
                    <CardDescription>{t('profile.description')}</CardDescription>
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
                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} aria-label={t('profile.changePicture')}>
                            {t('profile.changePicture')}
                        </Button>
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="email">{t('profile.email')}</Label>
                        <Input id="email" value={user.email} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="name">{t('profile.displayName')}</Label>
                        <Input id="name" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="jobTitle">{t('profile.jobTitle')}</Label>
                        <Input
                            id="jobTitle"
                            value={jobTitle}
                            onChange={e => setJobTitle(e.target.value)}
                            placeholder={t('profile.jobTitle')}
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t('profile.saveChanges')}
                    </Button>
                </CardFooter>
            </Card>

            {/* Work Preferences Card */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('preferences.title')}</CardTitle>
                    <CardDescription>
                        {canEditPreferences
                            ? t('preferences.description')
                            : t('preferences.managedByAdmin')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {!canEditPreferences && (
                        <div className="bg-muted/50 p-4 rounded-lg border text-sm text-muted-foreground">
                            {t('preferences.contactManager')}
                        </div>
                    )}
                    <div className={!canEditPreferences ? "opacity-60 pointer-events-none" : ""}>
                        <div className="space-y-3">
                            <Label>{t('preferences.workDays')}</Label>
                            <p className="text-xs text-muted-foreground">
                                {t('preferences.selectWorkDays')}
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
                            <Label htmlFor="target">{t('preferences.dailyTarget')}</Label>
                            <Input
                                id="target"
                                type="number"
                                step="0.5"
                                value={target}
                                onChange={e => setTarget(e.target.value)}
                                disabled={!canEditPreferences}
                            />
                            <p className="text-xs text-muted-foreground">
                                {t('preferences.dailyTargetDescription')}
                            </p>
                        </div>
                    </div>
                </CardContent>
                {canEditPreferences && (
                    <CardFooter>
                        <Button onClick={handlePreferencesSubmit} disabled={preferencesLoading}>
                            {preferencesLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('preferences.savePreferences')}
                        </Button>
                    </CardFooter>
                )}
            </Card>
        </div>
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
    const { t, dir } = useLanguage()

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
            <Card dir={dir}>
                <CardHeader>
                    <CardTitle>{t('security.title')}</CardTitle>
                    <CardDescription>{t('security.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="current">{t('security.currentPassword')}</Label>
                            <Input id="current" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="new">{t('security.newPassword')}</Label>
                            <Input id="new" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="confirm">{t('security.confirmPassword')}</Label>
                            <Input id="confirm" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                        </div>
                        <div className="pt-2">
                            <Button onClick={handleSubmit} disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t('security.updatePassword')}
                            </Button>
                        </div>
                    </div>

                    {/* Delete Account Section */}
                    <div className="pt-6 border-t">
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-lg font-semibold text-destructive">{t('security.deleteAccount')}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {t('security.deleteWarning')}
                                </p>
                            </div>
                            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4">
                                <p className="text-sm text-destructive">
                                    {t('security.deleteWarningText')}
                                </p>
                            </div>
                            <Button
                                variant="destructive"
                                onClick={handleDeleteClick}
                                className="gap-2"
                            >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                {t('security.deleteMyAccount')}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Delete Account Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('security.deleteAccount')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('security.deleteConfirm')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {requiresAdminTransfer && (
                        <div className="space-y-4 py-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                                <p className="text-sm text-amber-800">
                                    {t('security.transferAdmin')}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="newAdmin">{t('security.transferAdminTo')}</Label>
                                <Select value={newAdminId} onValueChange={setNewAdminId}>
                                    <SelectTrigger id="newAdmin">
                                        <SelectValue placeholder={t('security.selectUser')} />
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
                            {t('common.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting || (requiresAdminTransfer && !newAdminId)}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                    {t('security.deleting')}
                                </>
                            ) : (
                                t('security.deleteAccount')
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

function LanguageForm() {
    const [loading, setLoading] = useState(false)
    const { language: currentLanguage, setLanguage, t, dir } = useLanguage()
    const [language, setLanguageState] = useState<Language>(currentLanguage)
    const router = useRouter()

    useEffect(() => {
        setLanguageState(currentLanguage)
    }, [currentLanguage])

    const languages = [
        { value: 'en' as Language, label: 'English' },
        { value: 'he' as Language, label: 'עברית' },
    ]

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            // Update language using the context
            setLanguage(language)

            // Refresh to apply changes
            router.refresh()
            alert(t('language.saved'))
        } catch {
            alert(t('common.error'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card dir={dir}>
            <CardHeader>
                <CardTitle>{t('language.title')}</CardTitle>
                <CardDescription>{t('language.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-1">
                    <Label htmlFor="language">{t('language.selectLanguage')}</Label>
                    <Select value={language} onValueChange={(value) => setLanguageState(value as Language)} dir={dir}>
                        <SelectTrigger id="language">
                            <SelectValue placeholder={t('language.selectLanguage')} />
                        </SelectTrigger>
                        <SelectContent>
                            {languages.map(lang => (
                                <SelectItem key={lang.value} value={lang.value}>
                                    {lang.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        {t('language.descriptionText')}
                    </p>
                </div>
            </CardContent>
            <CardFooter>
                <Button onClick={handleSubmit} disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('language.saveLanguage')}
                </Button>
            </CardFooter>
        </Card>
    )
}

export { ProfileForm, SecurityForm, LanguageForm }
