"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState, useEffect } from "react"
import { Loader2, Check } from "lucide-react"
import { User } from "@prisma/client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { startTransition } from "react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/useLanguage"

interface ApproveUserDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    user: {
        id: string
        name: string
        email: string
    } | null
    managers?: User[] // Optional - will fetch from /api/team/hierarchy if not provided
    onApproved: () => void
}

export function ApproveUserDialog({ open, onOpenChange, user, managers: propManagers, onApproved }: ApproveUserDialogProps) {
    const router = useRouter()
    const { t } = useLanguage()
    
    // Tab state maps to role: 'employee' -> EMPLOYEE, 'chief' -> ADMIN
    const [activeTab, setActiveTab] = useState<"employee" | "chief">("employee")
    const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null)
    const [jobTitle, setJobTitle] = useState("")
    const [chiefType, setChiefType] = useState<'partner' | 'independent' | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [touched, setTouched] = useState(false)
    const [managers, setManagers] = useState<User[]>(propManagers || [])

    // Sync role with active tab
    const role = activeTab === "chief" ? "ADMIN" : "EMPLOYEE"

    // Show chief type when role is ADMIN
    const showChiefType = role === "ADMIN"

    // Fetch managers from /api/team/hierarchy (same as AddMemberDialog)
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

    // Reset selection when dialog opens/closes or user changes
    useEffect(() => {
        if (open && user) {
            setSelectedManagerId(null)
            setJobTitle("")
            setChiefType(null)
            setActiveTab("employee")
            setTouched(false)
            // Always fetch managers from /api/team/hierarchy (same as AddMemberDialog)
            // This ensures we get all admins and managers, not just filtered ones
            fetchManagers()
        }
    }, [open, user])

    const handleApprove = async () => {
        if (!user) return

        setTouched(true)

        // Validate based on role
        if (role === "EMPLOYEE") {
            // Require manager selection for team members (EMPLOYEE role)
            if (!selectedManagerId) {
                toast.error("Please select a manager. 'Reports To' is required.")
                return
            }
        } else if (role === "ADMIN") {
            // Require chief type selection for ADMIN
            if (!chiefType) {
                toast.error("Please select how this chief should be added (Partner or Independent)")
                return
            }
        }

        setIsSubmitting(true)
        try {
            const res = await fetch("/api/team/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user.id,
                    action: "APPROVE",
                    role,
                    jobTitle: jobTitle || undefined,
                    managerId: role === "EMPLOYEE" ? selectedManagerId : undefined,
                    chiefType: role === "ADMIN" ? chiefType : undefined
                })
            })

            const data = await res.json()

            if (!res.ok) {
                // Check if this is a user limit error
                if (res.status === 402 && data.error === "USER_LIMIT_EXCEEDED") {
                    // Redirect to pricing page
                    onOpenChange(false)
                    startTransition(() => {
                        router.push("/pricing")
                    })
                    toast.error(data.message || "User limit exceeded. Please upgrade your plan to approve this join request.")
                    return
                }
                
                throw new Error(data.message || "Failed to approve request")
            }

            toast.success(role === "ADMIN" ? "Chief approved and added to organization" : "Member approved and added to hierarchy")
            onApproved()
            onOpenChange(false)
            // Refresh to ensure the page shows the new user
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to approve request")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Approve Join Request</DialogTitle>
                    <DialogDescription>
                        Approve <strong>{user?.name}</strong> ({user?.email}) to join the team.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(v) => {
                    setActiveTab(v as "employee" | "chief")
                    // Reset managerId and chiefType when switching tabs
                    setSelectedManagerId(null)
                    setChiefType(null)
                }} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="employee">{t('roles.member')}</TabsTrigger>
                        <TabsTrigger value="chief">{t('roles.admin')}</TabsTrigger>
                    </TabsList>

                    <div className="space-y-4 py-4">
                        {/* User Info Display */}
                        {user && (
                            <div className="bg-muted p-3 rounded-md">
                                <p className="text-sm font-medium text-foreground mb-1">{user.name}</p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                        )}

                        {/* Job Title - Always visible */}
                        <div className="space-y-2">
                            <Label htmlFor="jobTitle">
                                Job Title
                            </Label>
                            <Input
                                id="jobTitle"
                                value={jobTitle}
                                onChange={(e) => setJobTitle(e.target.value)}
                                placeholder="e.g., Software Engineer"
                            />
                        </div>

                        {/* MEMBER (EMPLOYEE) - Reports To */}
                        {role === "EMPLOYEE" && (
                            <div className="space-y-2">
                                <Label htmlFor="manager">
                                    Reports To <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    value={selectedManagerId || ""}
                                    onValueChange={setSelectedManagerId}
                                >
                                    <SelectTrigger 
                                        id="manager"
                                        className={touched && !selectedManagerId ? "border-destructive" : ""}
                                    >
                                        <SelectValue placeholder="Select a manager..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {managers.length === 0 ? (
                                            <div className="p-2 text-sm text-muted-foreground text-center">
                                                No managers available
                                            </div>
                                        ) : (
                                            managers.map((manager) => (
                                                <SelectItem key={manager.id} value={manager.id}>
                                                    {manager.name} {manager.jobTitle ? `- ${manager.jobTitle}` : ""}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    The user will be immediately added to the hierarchy tree under the selected manager.
                                </p>
                            </div>
                        )}

                        {/* ADMIN - Chief Type */}
                        {role === "ADMIN" && showChiefType && (
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
                    </div>

                    <DialogFooter>
                        <Button 
                            variant="outline" 
                            onClick={() => onOpenChange(false)} 
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleApprove} 
                            disabled={
                                isSubmitting || 
                                (role === "EMPLOYEE" && !selectedManagerId) ||
                                (role === "ADMIN" && !chiefType)
                            }
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Approve
                        </Button>
                    </DialogFooter>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
