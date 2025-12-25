"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, X, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface RequestUser {
    id: string
    name: string
    email: string
    createdAt: string
}

export function JoinRequestsWidget() {
    const [requests, setRequests] = useState<RequestUser[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)

    const fetchRequests = async () => {
        try {
            const res = await fetch("/api/team/requests")
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

    useEffect(() => {
        fetchRequests()
    }, [])

    const handleAction = async (userId: string, action: "APPROVE" | "REJECT") => {
        setProcessingId(userId)
        try {
            const res = await fetch("/api/team/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, action })
            })

            if (!res.ok) throw new Error("Action failed")

            toast.success(action === "APPROVE" ? "Member approved" : "Request rejected")
            // Refresh list
            setRequests(prev => prev.filter(r => r.id !== userId))
        } catch {
            toast.error("Failed to process request")
        } finally {
            setProcessingId(null)
        }
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
                                    onClick={() => handleAction(request.id, "REJECT")}
                                    disabled={!!processingId}
                                >
                                    {processingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                </Button>
                                <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => handleAction(request.id, "APPROVE")}
                                    disabled={!!processingId}
                                >
                                    {processingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                    <span className="ml-2 hidden sm:inline">Approve</span>
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
