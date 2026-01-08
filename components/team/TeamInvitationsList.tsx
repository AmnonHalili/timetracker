"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Check, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useProject } from "@/components/providers/ProjectProvider"

interface Invitation {
    id: string
    project: {
        id: string
        name: string
        logo: string | null
    }
    role: string
    joinedAt: Date
}

interface TeamInvitationsListProps {
    invitations: Invitation[]
}

export function TeamInvitationsList({ invitations }: TeamInvitationsListProps) {
    const router = useRouter()
    const { respondToInvitation } = useProject()
    const [pendingInvites, setPendingInvites] = useState<Invitation[]>(invitations)
    const [processingId, setProcessingId] = useState<string | null>(null)

    const handleAction = async (projectId: string, action: "ACCEPT" | "REJECT") => {
        setProcessingId(projectId)
        try {
            await respondToInvitation(projectId, action)

            // Remove from local state
            setPendingInvites((prev) => prev.filter((inv) => inv.project.id !== projectId))

            if (action === "REJECT") {
                toast.success("Invitation declined")
            }
            // Accept is handled by provider which switches project + success toast

            router.refresh()
        } catch (error) {
            console.error(error)
            toast.error("Something went wrong")
        } finally {
            // If we switched project, component might unmount, but safe to reset if not
            setProcessingId(null)
        }
    }

    if (pendingInvites.length === 0) return null

    return (
        <Card className="border-l-4 border-l-blue-500 mb-6 md:mb-8 animate-in fade-in slide-in-from-top-4">
            <CardHeader className="pb-3 px-4 md:px-6 pt-4 md:pt-6">
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                    Project Invitations
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full dark:bg-blue-900/30 dark:text-blue-300">
                        {pendingInvites.length}
                    </span>
                </CardTitle>
                <CardDescription className="text-sm">
                    You have been invited to join these workspaces.
                </CardDescription>
            </CardHeader>
            <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                <div className="space-y-3 md:space-y-4">
                    {pendingInvites.map((invitation) => (
                        <div
                            key={invitation.id}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 md:p-4 rounded-lg border bg-card/50"
                        >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <Avatar className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
                                    <AvatarImage src={invitation.project.logo || ""} />
                                    <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                        {invitation.project.name.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-sm md:text-base truncate">{invitation.project.name}</div>
                                    <div className="text-xs md:text-sm text-muted-foreground">
                                        Invited as {invitation.role.toLowerCase()}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 sm:flex-shrink-0">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 flex-1 sm:flex-initial"
                                    disabled={processingId === invitation.project.id}
                                    onClick={() => handleAction(invitation.project.id, "REJECT")}
                                >
                                    {processingId === invitation.project.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <X className="h-4 w-4 mr-1" />
                                            Decline
                                        </>
                                    )}
                                </Button>
                                <Button
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-initial"
                                    disabled={processingId === invitation.project.id}
                                    onClick={() => handleAction(invitation.project.id, "ACCEPT")}
                                >
                                    {processingId === invitation.project.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Check className="h-4 w-4 mr-1" />
                                            Accept
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
