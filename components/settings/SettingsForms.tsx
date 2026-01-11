"use client"

import { toast } from "sonner"
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
import { Switch } from "@/components/ui/switch"

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
        weeklyHours?: Record<string, number> | null
        workMode?: 'OUTPUT_BASED' | 'TIME_BASED' | 'PROJECT_BASED'
        managerId?: string | null
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

    // Helper function to convert legacy format to weeklyHours
    const getWeeklyHoursFromLegacy = (): Record<number, number> => {
        if (user.weeklyHours) {
            // Convert string keys to numbers
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

    // Preferences state - use weeklyHours (per-day hours)
    const [weeklyHours, setWeeklyHours] = useState<Record<number, number>>(getWeeklyHoursFromLegacy())
    const [selectedDays, setSelectedDays] = useState<number[]>(() => {
        // Get selected days from weeklyHours (days with hours > 0)
        const hours = getWeeklyHoursFromLegacy()
        return Object.keys(hours).map(Number).filter(day => hours[day] > 0)
    })
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

    // Calculate if we should show the badge for work preferences
    const hasWorkPreferences = user.weeklyHours
        ? Object.keys(user.weeklyHours).length > 0 && Object.values(user.weeklyHours).some(h => h > 0)
        : ((user.workDays?.length ?? 0) > 0 && !!user.dailyTarget)
    const showPreferencesBadge = user.role === 'ADMIN' &&
        !user.managerId &&
        !hasWorkPreferences

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
        setSelectedDays(prev => {
            const isSelected = prev.includes(day)
            const newSelected = isSelected
                ? prev.filter(d => d !== day).sort((a, b) => a - b)
                : [...prev, day].sort((a, b) => a - b)

            // Update weeklyHours: remove if unselected, add with default if selected
            setWeeklyHours(currentHours => {
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
        if (!canEditPreferences) return
        const hoursNum = hours === "" ? 0 : parseFloat(hours)
        if (isNaN(hoursNum) || hoursNum < 0) return

        setWeeklyHours(prev => {
            const updated = { ...prev }
            if (hoursNum === 0) {
                delete updated[day]
                // Remove from selected days if hours set to 0
                setSelectedDays(current => current.filter(d => d !== day))
            } else {
                updated[day] = hoursNum
                // Add to selected days if not already there
                setSelectedDays(current => {
                    if (!current.includes(day)) {
                        return [...current, day].sort((a, b) => a - b)
                    }
                    return current
                })
            }
            return updated
        })
    }

    const renderDayItem = (day: { value: number, label: string }) => {
        const isSelected = selectedDays.includes(day.value);
        return (
            <div
                key={day.value}
                className={`flex items-center justify-between p-3 rounded-md border transition-all ${isSelected ? 'bg-primary/5 border-primary/20' : 'bg-transparent border-transparent hover:bg-muted/50'} ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}
            >
                <div className={`flex items-center gap-3 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                    <Switch
                        checked={isSelected}
                        onCheckedChange={() => toggleDay(day.value)}
                        id={`settings-day-switch-${day.value}`}
                        disabled={!canEditPreferences}
                    />
                    <Label
                        htmlFor={`settings-day-switch-${day.value}`}
                        className={`font-medium cursor-pointer ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                        {day.label}
                    </Label>
                </div>

                {isSelected && (
                    <div className={`flex items-center gap-1.5 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                        <Input
                            type="number"
                            step="0.5"
                            min="0"
                            value={weeklyHours[day.value]?.toString() || ""}
                            onChange={e => updateDayHours(day.value, e.target.value)}
                            placeholder="8"
                            className="w-16 h-7 text-center text-sm px-1"
                            dir="ltr"
                            disabled={!canEditPreferences}
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
    }

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (file.size > 1024 * 1024) { // 1MB limit for Base64
                toast.error("Image too large. Please use an image under 1MB.")
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
            toast.success(t('profile.updated'))
        } catch (error) {
            console.error(error)
            toast.error(t('common.error'))
        } finally {
            setLoading(false)
        }
    }

    const handlePreferencesSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setPreferencesLoading(true)
        try {
            // Only send hours for selected days
            const weeklyHoursToSend: Record<number, number> = {}
            selectedDays.forEach(day => {
                if (weeklyHours[day] && weeklyHours[day] > 0) {
                    weeklyHoursToSend[day] = weeklyHours[day]
                }
            })

            const res = await fetch("/api/user/preferences", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    weeklyHours: weeklyHoursToSend,
                    workMode
                }),
            })
            if (!res.ok) throw new Error("Failed to update")
            router.refresh()
            toast.success(t('preferences.updated'))
        } catch (error) {
            console.error(error)
            toast.error(t('common.error'))
        } finally {
            setPreferencesLoading(false)
        }
    }

    return (
        <div className="space-y-6" dir={dir}>
            {/* ... (Profile Information Card remains unchanged) ... */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('profile.title')}</CardTitle>
                    <CardDescription>{t('profile.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* ... (Profile Form content) ... */}
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
                    <CardTitle className="flex items-center gap-2">
                        {t('preferences.title')}
                        {showPreferencesBadge && (
                            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        )}
                    </CardTitle>
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
                        <div className="space-y-4">
                            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${dir === 'rtl' ? 'sm:flex-row-reverse' : ''}`}>
                                {/* Quick Actions - On left in RTL, right in LTR */}
                                <div className={`flex gap-2 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const standardDays = [0, 1, 2, 3, 4]; // Sun-Thu
                                            setSelectedDays(standardDays);
                                            setWeeklyHours(prev => {
                                                const updated = { ...prev };
                                                standardDays.forEach(d => {
                                                    if (!updated[d]) updated[d] = 8;
                                                });
                                                return updated;
                                            });
                                        }}
                                        className="text-xs h-8 px-2"
                                    >
                                        {t('preferences.sunThu')}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const standardDays = [1, 2, 3, 4, 5]; // Mon-Fri
                                            setSelectedDays(standardDays);
                                            setWeeklyHours(prev => {
                                                const updated = { ...prev };
                                                standardDays.forEach(d => {
                                                    if (!updated[d]) updated[d] = 8;
                                                });
                                                return updated;
                                            });
                                        }}
                                        className="text-xs h-8 px-2"
                                    >
                                        {t('preferences.monFri')}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setSelectedDays([]);
                                            setWeeklyHours({});
                                        }}
                                        className="text-xs h-8 px-2 text-muted-foreground hover:text-destructive"
                                    >
                                        {t('preferences.clear')}
                                    </Button>
                                </div>

                                {/* Work Days Label - On right in RTL, left in LTR */}
                                <div className={`space-y-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                                    <Label>{t('preferences.workDays')}</Label>
                                    <p className="text-xs text-muted-foreground">
                                        {t('preferences.selectWorkDays')}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" dir="ltr">
                                {/* Left Column: Sun-Wed */}
                                <div className="space-y-3">
                                    {daysOfWeek.filter(d => d.value <= 3).map(day => renderDayItem(day))}
                                </div>

                                {/* Right Column: Thu-Sat */}
                                <div className="space-y-3">
                                    {daysOfWeek.filter(d => d.value > 3).map(day => renderDayItem(day))}
                                </div>
                            </div>
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
            toast.error("New passwords do not match")
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
            toast.success("Password changed successfully")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error updating password")
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
            toast.error(error instanceof Error ? error.message : "Error deleting account")
        } finally {
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
            toast.success(t('language.saved'))
        } catch (error) {
            console.error(error)
            toast.error(t('common.error'))
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
