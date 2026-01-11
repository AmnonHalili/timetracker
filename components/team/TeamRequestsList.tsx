"use client"

import { useState, useEffect, startTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Check, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { ApproveUserDialog } from "./ApproveUserDialog"
import { User } from "@prisma/client"

interface PendingRequest {
    id: string
    name: string
    email: string
    image?: string | null
    createdAt: Date
}

interface TeamRequestsListProps {
    initialRequests: PendingRequest[]
}

export function TeamRequestsList({ initialRequests }: TeamRequestsListProps) {
    const router = useRouter()
    const [requests, setRequests] = useState<PendingRequest[]>(initialRequests)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [approveDialogOpen, setApproveDialogOpen] = useState(false)
    const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null)
    const [availableManagers, setAvailableManagers] = useState<User[]>([])
    const [loadingManagers, setLoadingManagers] = useState(false)

    const fetchManagers = async () => {
        setLoadingManagers(true)
        try {
            const res = await fetch("/api/team")
            if (res.ok) {
                const users = await res.json()
                // Filter to only ADMIN and MANAGER roles
                const managers = users.filter((u: User) => 
                    u.role === "ADMIN" || u.role === "MANAGER"
                )
                setAvailableManagers(managers)
            }
        } catch (error) {
            console.error("Failed to fetch managers", error)
        } finally {
            setLoadingManagers(false)
        }
    }

    const fetchRequests = async () => {
        try {
            const res = await fetch("/api/team/requests", { cache: 'no-store' })
            if (res.ok) {
                const data = await res.json()
                setRequests(data)
            }
        } catch (error) {
            console.error("Failed to fetch requests", error)
        }
    }

    useEffect(() => {
        fetchManagers()
    }, [])

    // Poll for new requests every 5-10 seconds
    // Adaptive: faster when there are requests, slower when none
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null
        
        const setupPolling = () => {
            // Clear existing interval
            if (interval) clearInterval(interval)
            
            // Poll every 5 seconds if there are requests, 10 seconds otherwise
            const pollInterval = requests.length > 0 ? 5000 : 10000
            interval = setInterval(() => {
                fetchRequests()
            }, pollInterval)
        }
        
        // Initial fetch to sync with server
        fetchRequests()
        setupPolling()
        
        // Handle visibility change - refresh immediately when page becomes visible
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                fetchRequests()
            }
        }
        
        // Handle window focus - refresh immediately when window gains focus
        const handleFocus = () => {
            fetchRequests()
        }
        
        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('focus', handleFocus)
        
        return () => {
            if (interval) clearInterval(interval)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('focus', handleFocus)
        }
    }, [requests.length])

    const handleApproveClick = (request: PendingRequest) => {
        setSelectedRequest(request)
        setApproveDialogOpen(true)
    }

    const handleReject = async (userId: string) => {
        setProcessingId(userId)
        
        // Optimistic update: remove from UI immediately
        const rejectedRequest = requests.find(r => r.id === userId)
        setRequests((prev) => prev.filter((r) => r.id !== userId))
        
        try {
            const res = await fetch("/api/team/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, action: "REJECT" })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.message || "Failed to process request")
            }

            toast.success("User rejected")
            router.refresh()
        } catch (error) {
            // Revert optimistic update on error
            if (rejectedRequest) {
                setRequests((prev) => [...prev, rejectedRequest].sort((a, b) => 
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                ))
            }
            console.error(error)
            toast.error(error instanceof Error ? error.message : "Something went wrong")
        } finally {
            setProcessingId(null)
        }
    }

    const handleApproved = () => {
        // Optimistic update: remove from UI immediately (already done in ApproveUserDialog)
        // This is called after successful approval
        if (selectedRequest) {
            setRequests((prev) => prev.filter((r) => r.id !== selectedRequest.id))
        }
        setSelectedRequest(null)
        router.refresh()
    }

    if (requests.length === 0) return null

    return (
        <Card className="border-l-4 border-l-primary mb-6 md:mb-8 animate-in fade-in slide-in-from-top-4">
            <CardHeader className="pb-3 px-4 md:px-6 pt-4 md:pt-6">
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                    Pending Join Requests
                    <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                        {requests.length}
                    </span>
                </CardTitle>
                <CardDescription className="text-sm">
                    These users have requested to join your team via your Team Code.
                </CardDescription>
            </CardHeader>
            <CardContent className="px-4 md:px-6 pb-4 md:pb-6">
                <div className="space-y-3 md:space-y-4">
                    {requests.map((request) => (
                        <div
                            key={request.id}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 md:p-4 rounded-lg border bg-card/50"
                        >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <Avatar className="h-10 w-10 md:h-12 md:w-12 flex-shrink-0">
                                    <AvatarImage src={request.image || ""} />
                                    <AvatarFallback>{request.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-sm md:text-base truncate">{request.name}</div>
                                    <div className="text-xs md:text-sm text-muted-foreground truncate">{request.email}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 sm:flex-shrink-0">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 flex-1 sm:flex-initial"
                                    disabled={processingId === request.id}
                                    onClick={() => handleReject(request.id)}
                                >
                                    {processingId === request.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <X className="h-4 w-4 mr-1" />
                                            Reject
                                        </>
                                    )}
                                </Button>
                                <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-initial"
                                    disabled={processingId === request.id || loadingManagers}
                                    onClick={() => handleApproveClick(request)}
                                >
                                    <Check className="h-4 w-4 mr-1" />
                                    Approve
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
            
            <ApproveUserDialog
                open={approveDialogOpen}
                onOpenChange={setApproveDialogOpen}
                user={selectedRequest ? {
                    id: selectedRequest.id,
                    name: selectedRequest.name,
                    email: selectedRequest.email
                } : null}
                managers={availableManagers}
                onApproved={handleApproved}
            />
        </Card>
    )
}
