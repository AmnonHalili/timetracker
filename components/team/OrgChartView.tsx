"use client"

import { OrgChart } from "./OrgChart"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface GroupWithRelations {
    id: string
    name: string
    description: string | null
    color: string
    manager: {
        id: string
        name: string
        email: string
        role: string
        image: string | null
    } | null
    members: {
        id: string
        name: string
        email: string
        role: string
        image: string | null
    }[]
}

interface SimpleUser {
    id: string
    name: string
    email: string
    role: string
    image: string | null
}

interface OrgChartViewProps {
    groups: GroupWithRelations[]
    adminUser: SimpleUser | null
    unassignedUsers: SimpleUser[]
    currentUserRole: string
}

export function OrgChartView({ groups, adminUser, unassignedUsers, currentUserRole }: OrgChartViewProps) {
    const router = useRouter()
    const [saving, setSaving] = useState(false)

    const handleAssignToGroup = async (userId: string, groupId: string | null) => {
        setSaving(true)
        try {
            if (!groupId) {
                // Unassign from group - we would need an endpoint for this
                // For now, just refresh
                router.refresh()
                return
            }

            const res = await fetch(`/api/groups/${groupId}/assign-member`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.message || "Failed to assign member")
            }

            router.refresh()
        } catch (error) {
            alert(error instanceof Error ? error.message : "Error assigning member")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="container mx-auto space-y-6 py-6">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <Link href="/team">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <h1 className="text-3xl font-bold tracking-tight">Team Hierarchy</h1>
                    </div>
                    <p className="text-muted-foreground mt-1 ml-14">
                        Group-based organizational structure
                        {currentUserRole === "ADMIN" && " • Drag members to reassign"}
                    </p>
                </div>
            </div>

            <div className="bg-card rounded-lg border p-6">
                <OrgChart
                    groups={groups}
                    adminUser={adminUser}
                    unassignedUsers={unassignedUsers}
                    currentUserRole={currentUserRole}
                    onAssignToGroup={currentUserRole === "ADMIN" ? handleAssignToGroup : undefined}
                />
            </div>

            {saving && (
                <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg">
                    Saving changes...
                </div>
            )}
        </div>
    )
}
