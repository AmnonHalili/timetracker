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

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

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
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const defaultTriggerLabel = triggerLabel || t('team.addMember')
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [role] = useState(defaultRole) // Changed from [role, setRole] to [role]
    const [jobTitle, setJobTitle] = useState("")
    const [managerId, setManagerId] = useState<string>(hideManagerSelect ? "unassigned" : "")
    const [managers, setManagers] = useState<SimpleUser[]>([])
    // Chief type selection: 'partner' | 'independent' | null
    const [chiefType, setChiefType] = useState<'partner' | 'independent' | null>(null)

    // Fetch potential managers when dialog opens
    useEffect(() => {
        if (open) {
            fetchManagers()
        }
    }, [open])

    const fetchManagers = async () => {
        try {
            // Using logic similar to hierarchy fetching but flat list
            const res = await fetch("/api/team/hierarchy")
            if (res.ok) {
                const data = await res.json()
                // setManagers(data.users || [])
                // We typically only assign to existing Admins or Managers, 
                // but any user could theoretically be a manager in the new system.
                // Let's filter slightly or show all.
                setManagers(data.users || [])
            }
        } catch (error) {
            console.error("Failed to fetch managers:", error)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // If adding a chief (ADMIN role with hideManagerSelect), require chief type selection
        if (role === "ADMIN" && hideManagerSelect && !chiefType) {
            alert("Please select how this chief should be added (Partner or Independent)")
            return
        }

        setLoading(true)

        try {
            const res = await fetch("/api/team/members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    role,
                    jobTitle,
                    managerId: managerId === "unassigned" ? null : managerId,
                    chiefType: role === "ADMIN" && hideManagerSelect ? chiefType : undefined
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                const errorMsg = data.error
                    ? `${data.message}: ${data.error}`
                    : data.message || "Failed to add member"
                throw new Error(errorMsg)
            }

            setOpen(false)
            router.refresh()
            if (onSuccess) onSuccess()
            // Reset form
            setName("")
            setEmail("")
            setPassword("")
            setJobTitle("")
            setManagerId(hideManagerSelect ? "unassigned" : "")
            setChiefType(null)
        } catch (error) {
            alert(error)
        } finally {
            setLoading(false)
        }
    }

    // Reset chief type when dialog closes
    useEffect(() => {
        if (!open) {
            setChiefType(null)
        }
    }, [open])

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {customTrigger ? (
                    customTrigger
                ) : (
                    <Button>
                        <UserPlus className="mr-2 h-4 w-4" />
                        {defaultTriggerLabel}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader className="text-right">
                        <DialogTitle className="text-right">
                            {role === "ADMIN" ? t('team.addNewChief') : t('team.addTeamMember')}
                        </DialogTitle>
                        <DialogDescription className="text-right">
                            {role === "ADMIN"
                                ? t('team.createChiefAccount')
                                : t('team.createEmployeeAccount')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Name
                            </Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="email" className="text-right">
                                Email
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="password" className="text-right">
                                Initial Password
                            </Label>
                            <Input
                                id="password"
                                type="text"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="col-span-3"
                            />
                        </div>

                        {!hideManagerSelect && (
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="manager" className="text-right">
                                    Reports To
                                </Label>
                                <div className="col-span-3">
                                    <Select onValueChange={setManagerId} value={managerId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Manager (Optional)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned">No Manager (Top Level)</SelectItem>
                                            {managers.map((user) => (
                                                <SelectItem key={user.id} value={user.id}>
                                                    {user.name} {user.jobTitle ? `- ${user.jobTitle}` : ""}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {/* Role selector removed as per user request, defaults to EMPLOYEE */}

                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="jobTitle" className="text-right">
                                Job Title
                            </Label>
                            <Input
                                id="jobTitle"
                                value={jobTitle}
                                onChange={(e) => setJobTitle(e.target.value)}
                                className="col-span-3"
                            />
                        </div>

                        {/* Chief Type Selection - Only shown when adding a chief */}
                        {role === "ADMIN" && hideManagerSelect && (
                            <div className="space-y-4 pt-2">
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
                                                    This chief will act as a shared manager together with the chief who added them. Both chiefs behave as a single logical entity in terms of permissions and data.
                                                </p>
                                                <p className="text-xs font-medium text-primary mt-2">
                                                    Use this option when two founders / partners manage the same team together.
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
                                                    Independent Chief – Separate Branch
                                                </h4>
                                                <p className="text-sm text-muted-foreground mb-2">
                                                    This chief will be added as a separate top-level manager with their own hierarchy.
                                                </p>
                                                <p className="text-xs font-medium text-primary mt-2">
                                                    Use this option when adding a new senior manager who manages their own team.
                                                </p>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Account
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
