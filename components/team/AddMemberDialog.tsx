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
import { useState, useEffect } from "react"
import { Loader2, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"

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
    triggerLabel = "Add Member",
    onSuccess,
    customTrigger
}: AddMemberDialogProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [role] = useState(defaultRole) // Changed from [role, setRole] to [role]
    const [jobTitle, setJobTitle] = useState("")
    const [managerId, setManagerId] = useState<string>(hideManagerSelect ? "unassigned" : "")
    const [managers, setManagers] = useState<SimpleUser[]>([])

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
        setLoading(true)

        try {
            const res = await fetch("/api/team/members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    email,
                    role,
                    jobTitle,
                    managerId: managerId === "unassigned" ? null : managerId
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.message || "Failed to add member")
            }

            setOpen(false)
            router.refresh()
            if (onSuccess) onSuccess()
            // Reset form
            setName("")
            setEmail("")
            setManagerId(hideManagerSelect ? "unassigned" : "")
        } catch (error) {
            alert(error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {customTrigger ? (
                    customTrigger
                ) : (
                    <Button>
                        <UserPlus className="mr-2 h-4 w-4" />
                        {triggerLabel}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Add Team Member</DialogTitle>
                        <DialogDescription>
                            Create a new account for your employee. They will be added to your project immediately.
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
