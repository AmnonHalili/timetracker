"use client"

import { useEffect, useState, startTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { ApproveUserDialog } from "./ApproveUserDialog"
import { User } from "@prisma/client"

interface RequestUser {
    id: string
    name: string
    email: string
    createdAt: string
}

export function JoinRequestsWidget() {
    const router = useRouter()
    const [requests, setRequests] = useState<RequestUser[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [approveDialogOpen, setApproveDialogOpen] = useState(false)
    const [selectedRequest, setSelectedRequest] = useState<RequestUser | null>(null)
    const [availableManagers, setAvailableManagers] = useState<User[]>([])
    const [loadingManagers, setLoadingManagers] = useState(false)

    const fetchRequests = async () => {
        try {
            const res = await fetch("/api/team/requests", { cache: 'no-store' })
            if (res.ok) {
                const data = await res.json()
                setRequests(data)
            }
        } catch (error) {
            console.error("Failed to fetch requests", error)
        } finally {
            setLoading(false)
        }
    }

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

    useEffect(() => {
        fetchRequests()
        fetchManagers()
    }, [])

    // Poll for new requests every 5-10 seconds
    // Adaptive: faster when there are requests, slower when none
    useEffect(() => {
        if (loading) return // Don't poll while initial loading
        
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, requests.length])

    const handleApproveClick = (request: RequestUser) => {
        setSelectedRequest(request)
        setApproveDialogOpen(true)
    }

    const handleReject = async (userId: string) => {
        setProcessingId(userId)
        
        // Optimistic update: remove from UI immediately
        const rejectedRequest = requests.find(r => r.id === userId)
        setRequests(prev => prev.filter(r => r.id !== userId))
        
        try {
            const res = await fetch("/api/team/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, action: "REJECT" })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.message || "Action failed")
            }

            toast.success("Request rejected")
        } catch (error) {
            // Revert optimistic update on error
            if (rejectedRequest) {
                setRequests(prev => [...prev, rejectedRequest].sort((a, b) => 
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                ))
            }
            toast.error(error instanceof Error ? error.message : "Failed to reject request")
        } finally {
            setProcessingId(null)
        }
    }

    const handleApproved = () => {
        // Remove the approved request from the list
        if (selectedRequest) {
            setRequests(prev => prev.filter(r => r.id !== selectedRequest.id))
        }
        setSelectedRequest(null)
        // Refresh the page to show the new user in the team list
        router.refresh()
    }

    if (loading) return null // Or return nothing if loading initial state quietly
    if (requests.length === 0) return null

    return (
        <Card className="mb-8 border-yellow-500/50 bg-yellow-500/10">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                    Pending Join Requests
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500 text-[10px] font-bold text-white">
                        {requests.length}
                    </span>
                </CardTitle>
                <CardDescription>
                    These users have requested to join your team.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {requests.map(request => (
                        <div key={request.id} className="flex items-center justify-between rounded-lg border bg-background p-3">
                            <div>
                                <p className="font-medium">{request.name}</p>
                                <p className="text-sm text-muted-foreground">{request.email}</p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    onClick={() => handleReject(request.id)}
                                    disabled={!!processingId}
                                >
                                    {processingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                </Button>
                                <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => handleApproveClick(request)}
                                    disabled={!!processingId || loadingManagers}
                                >
                                    <Check className="h-4 w-4" />
                                    <span className="ml-2 hidden sm:inline">Approve</span>
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
            
            <ApproveUserDialog
                open={approveDialogOpen}
                onOpenChange={setApproveDialogOpen}
                user={selectedRequest}
                managers={availableManagers}
                onApproved={handleApproved}
            />
        </Card>
    )
}
