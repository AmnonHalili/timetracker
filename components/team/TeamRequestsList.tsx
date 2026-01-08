"use client"

import { useState, startTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Check, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

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

    const handleAction = async (userId: string, action: "APPROVE" | "REJECT") => {
        setProcessingId(userId)
        try {
            const res = await fetch("/api/team/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, action }),
            })

            if (!res.ok) {
                const data = await res.json()
                
                // Check if this is a user limit error
                if (res.status === 402 && data.error === "USER_LIMIT_EXCEEDED") {
                    // Redirect to pricing page
                    startTransition(() => {
                        router.push("/pricing")
                    })
                    toast.error(data.message || "User limit exceeded. Please upgrade your plan to approve this join request.")
                    return
                }
                
                throw new Error(data.message || "Failed to process request")
            }

            // Remove from local state
            setRequests((prev) => prev.filter((r) => r.id !== userId))
            toast.success(action === "APPROVE" ? "User approved" : "User rejected")
            router.refresh()
        } catch (error) {
            console.error(error)
            toast.error("Something went wrong")
        } finally {
            setProcessingId(null)
        }
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
                                    onClick={() => handleAction(request.id, "REJECT")}
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
                                    disabled={processingId === request.id}
                                    onClick={() => handleAction(request.id, "APPROVE")}
                                >
                                    {processingId === request.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Check className="h-4 w-4 mr-1" />
                                            Approve
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
