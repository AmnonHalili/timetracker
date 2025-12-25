"use client"

import { useState } from "react"
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

            if (!res.ok) throw new Error("Failed to process request")

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
        <Card className="border-l-4 border-l-primary mb-8 animate-in fade-in slide-in-from-top-4">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    Pending Join Requests
                    <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                        {requests.length}
                    </span>
                </CardTitle>
                <CardDescription>
                    These users have requested to join your team via your Team Code.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {requests.map((request) => (
                        <div
                            key={request.id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                        >
                            <div className="flex items-center gap-3">
                                <Avatar>
                                    <AvatarImage src={request.image || ""} />
                                    <AvatarFallback>{request.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="font-semibold">{request.name}</div>
                                    <div className="text-sm text-muted-foreground">{request.email}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
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
                                    className="bg-green-600 hover:bg-green-700 text-white"
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
