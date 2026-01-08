"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { useState, useEffect } from "react"
import { Loader2, UserPlus, Check } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/useLanguage"
import { startTransition } from "react"
import { useSession } from "next-auth/react"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"

interface SimpleUser {
    id: string
    name: string
    role: string
    jobTitle?: string | null
}

interface AddMemberDialogProps {
    defaultRole?: string
    lockRole?: boolean
    hideManagerSelect?: boolean
    triggerLabel?: string
    onSuccess?: () => void
    customTrigger?: React.ReactNode
}

export function AddMemberDialog({
    defaultRole = "EMPLOYEE",
    // lockRole = false, // Unused
    hideManagerSelect = false,
    triggerLabel,
    onSuccess,
    customTrigger
}: AddMemberDialogProps) {
    const { t } = useLanguage()
    const { data: session } = useSession()
    const router = useRouter()
    const [open, setOpen] = useState(false)

    // Check if current user is top-level admin (has no manager)
    const isAdmin = session?.user?.role === "ADMIN"



    const defaultTriggerLabel = triggerLabel || t('team.addMember')
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState("")

    // Tab state maps to role: 'employee' -> EMPLOYEE, 'chief' -> ADMIN
    const [activeTab, setActiveTab] = useState<"employee" | "chief">("employee")

    const [jobTitle, setJobTitle] = useState("")
    const [managerId, setManagerId] = useState<string>("")
    const [managers, setManagers] = useState<SimpleUser[]>([])

    // Chief type selection: 'partner' | 'independent' | null
    const [chiefType, setChiefType] = useState<'partner' | 'independent' | null>(null)
    const [showChiefType, setShowChiefType] = useState(false)

    // Sync role with active tab
    const role = activeTab === "chief" ? "ADMIN" : "EMPLOYEE"

    // Fetch potential managers when dialog opens
    useEffect(() => {
        if (open) {
            fetchManagers()
            // Reset tab to default if not explicitly set (could add props for default tab if needed)
            if (defaultRole === "ADMIN") {
                setActiveTab("chief")
            } else {
                setActiveTab("employee")
            }
        }
    }, [open, defaultRole])

    const fetchManagers = async () => {
        try {
            const res = await fetch("/api/team/hierarchy")
            if (res.ok) {
                const data = await res.json()
                setManagers(data.users || [])
            }
        } catch (error) {
            console.error("Failed to fetch managers:", error)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Require manager selection for team members (EMPLOYEE role)
        if (role === "EMPLOYEE" && (!managerId || managerId === "unassigned")) {
            toast.error("Please select a manager for the team member. 'Reports To' is required.")
            return
        }

        // If adding a chief (ADMIN role) without a manager, require chief type selection
        if (role === "ADMIN" && (managerId === "unassigned" || !managerId)) {
            if (!chiefType) {
                toast.error("Please select how this chief should be added (Partner or Independent)")
                return
            }
        }

        setLoading(true)

        try {
            const res = await fetch("/api/team/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify({
                    email,
                    role,
                    jobTitle,
                    managerId: managerId === "unassigned" || !managerId ? null : managerId,
                    chiefType: role === "ADMIN" && (managerId === "unassigned" || !managerId) ? chiefType : undefined
                }),
            })

            if (!res.ok) {
                const data = await res.json()

                if (res.status === 402 && data.error === "USER_LIMIT_EXCEEDED") {
                    setOpen(false)
                    startTransition(() => {
                        router.push("/pricing")
                    })
                    toast.error(data.message || "User limit exceeded. Please upgrade your plan to add more team members.")
                    return
                }

                const errorMsg = data.error
                    ? `${data.message}: ${data.error}`
                    : data.message || "Failed to send invitation"
                throw new Error(errorMsg)
            }

            const responseData = await res.json()

            setOpen(false)
            router.refresh()
            if (onSuccess) onSuccess()

            // Reset form
            setEmail("")
            setJobTitle("")
            setManagerId("")
            setChiefType(null)
            setActiveTab("employee")

            // Show appropriate success message
            if (responseData.isExistingUser) {
                toast.success(`Join request sent to ${email}`)
            } else {
                toast.success(`Invitation sent to ${email}`)
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An error occurred"
            toast.error(errorMessage)
        } finally {
            setLoading(false)
        }
    }

    // Reset chief type and show state when dialog closes or manager changes
    useEffect(() => {
        if (!open) {
            setChiefType(null)
            setShowChiefType(false)
        }
    }, [open])

    // Update showChiefType when managerId changes
    useEffect(() => {
        if (role === "ADMIN") {
            setShowChiefType(managerId === "unassigned" || !managerId)
        } else {
            setShowChiefType(false)
        }
    }, [managerId, role])

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {customTrigger ? (
                    customTrigger
                ) : (
                    <Button
                        className="h-10 rounded-xl font-medium shadow-sm hover:shadow transition-all duration-200 w-full md:w-auto"
                    >
                        <UserPlus className="mr-2 h-4 w-4" />
                        {defaultTriggerLabel}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader className="text-left">
                    <DialogTitle className="text-left">
                        {role === "ADMIN" ? t('team.addNewChief') : t('team.addTeamMember')}
                    </DialogTitle>
                    <DialogDescription className="text-left">
                        {role === "ADMIN"
                            ? t('team.createChiefAccount')
                            : t('team.createEmployeeAccount')}
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(v) => {
                    setActiveTab(v as "employee" | "chief")
                    // Reset managerId when switching tabs
                    setManagerId("")
                }} className="w-full">
                    {isAdmin && (
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="employee">{t('roles.member')}</TabsTrigger>
                            <TabsTrigger value="chief">{t('roles.admin')}</TabsTrigger>
                        </TabsList>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4">
                            {/* Common Fields */}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="email" className="text-left">
                                    Email
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value.toLowerCase())}
                                    className="col-span-3"
                                    placeholder="user@example.com"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="jobTitle" className="text-left">
                                    Job Title
                                </Label>
                                <Input
                                    id="jobTitle"
                                    value={jobTitle}
                                    onChange={(e) => setJobTitle(e.target.value)}
                                    className="col-span-3"
                                />
                            </div>

                            {/* Manager Selection - Only shown for Team Members (EMPLOYEE role) */}
                            {!hideManagerSelect && role === "EMPLOYEE" && (
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="manager" className="text-left">
                                        {t('team.reportsTo')}
                                        <span className="text-destructive ml-1">*</span>
                                    </Label>
                                    <div className="col-span-3">
                                        <Select
                                            onValueChange={(value) => {
                                                setManagerId(value)
                                            }}
                                            value={managerId || undefined}
                                            required
                                        >
                                            <SelectTrigger className={!managerId ? "border-destructive" : ""}>
                                                <SelectValue placeholder={t('team.selectManagerRequired')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {/* For Employees, show all managers */}
                                                {managers.map((user) => (
                                                    <SelectItem key={user.id} value={user.id}>
                                                        {user.name} {user.jobTitle ? `- ${user.jobTitle}` : ""}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[10px] text-muted-foreground mt-1 mx-1">
                                            {t('team.teamMemberMustReport')}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Chief Specific UI */}
                            <TabsContent value="chief" className="mt-0 space-y-4">
                                {showChiefType && (
                                    <div className="space-y-4 pt-2 border-t mt-4">
                                        <div>
                                            <Label className="text-base font-semibold">
                                                Chief Type <span className="text-destructive">*</span>
                                            </Label>
                                            <p className="text-sm text-muted-foreground mt-1 mb-4">
                                                Select how this chief should be added to the organization
                                            </p>
                                        </div>

                                        <div className="grid gap-3">
                                            {/* Option 1: Partner */}
                                            <Card
                                                className={cn(
                                                    "p-4 cursor-pointer border-2 transition-all hover:border-primary/50",
                                                    chiefType === "partner"
                                                        ? "border-primary bg-primary/5"
                                                        : "border-border"
                                                )}
                                                onClick={() => setChiefType("partner")}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={cn(
                                                        "mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                                                        chiefType === "partner"
                                                            ? "border-primary bg-primary"
                                                            : "border-muted-foreground"
                                                    )}>
                                                        {chiefType === "partner" && (
                                                            <Check className="h-3 w-3 text-primary-foreground" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-semibold text-sm mb-1">
                                                            Partner – Shared Leadership
                                                        </h4>
                                                        <p className="text-sm text-muted-foreground mb-2">
                                                            Acts as a shared manager with you. Both manage the same team.
                                                        </p>
                                                    </div>
                                                </div>
                                            </Card>

                                            {/* Option 2: Independent */}
                                            <Card
                                                className={cn(
                                                    "p-4 cursor-pointer border-2 transition-all hover:border-primary/50",
                                                    chiefType === "independent"
                                                        ? "border-primary bg-primary/5"
                                                        : "border-border"
                                                )}
                                                onClick={() => setChiefType("independent")}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={cn(
                                                        "mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                                                        chiefType === "independent"
                                                            ? "border-primary bg-primary"
                                                            : "border-muted-foreground"
                                                    )}>
                                                        {chiefType === "independent" && (
                                                            <Check className="h-3 w-3 text-primary-foreground" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-semibold text-sm mb-1">
                                                            Independent Chief
                                                        </h4>
                                                        <p className="text-sm text-muted-foreground mb-2">
                                                            Separate top-level manager with their own hierarchy.
                                                        </p>
                                                    </div>
                                                </div>
                                            </Card>
                                        </div>
                                    </div>
                                )}
                            </TabsContent>
                        </div>

                        <DialogFooter>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Send Invitation
                            </Button>
                        </DialogFooter>
                    </form>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
