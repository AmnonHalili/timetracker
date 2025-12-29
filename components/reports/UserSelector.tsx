"use client"

import { startTransition } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter, useSearchParams } from "next/navigation"
import { useLanguage } from "@/lib/useLanguage"

interface UserSelectorProps {
    users: { id: string; name: string | null; email: string }[]
    currentUserId: string
    loggedInUserId: string // The actual logged-in user ID (for showing "you")
}

export function UserSelector({ users, currentUserId, loggedInUserId }: UserSelectorProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { t } = useLanguage()

    const handleUserChange = (value: string) => {
        const params = new URLSearchParams(searchParams)
        if (value === "all") {
            params.set("userId", "all")
        } else {
            params.set("userId", value)
        }
        startTransition(() => {
            router.push(`?${params.toString()}`)
        })
    }

    if (users.length === 0) return null

    // Determine display value - show "all" if selected, otherwise currentUserId
    const displayValue = searchParams.get("userId") === "all" ? "all" : currentUserId

    return (
        <Select value={displayValue} onValueChange={handleUserChange}>
            <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select User" />
            </SelectTrigger>
            <SelectContent>
                {/* All Users option - only show if there are multiple users */}
                {users.length > 1 && (
                    <SelectItem value="all">
                        {t('reports.allUsers')}
                    </SelectItem>
                )}
                {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email} {user.id === loggedInUserId && "(you)"}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
