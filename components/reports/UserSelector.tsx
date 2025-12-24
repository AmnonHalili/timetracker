"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter, useSearchParams } from "next/navigation"

interface UserSelectorProps {
    users: { id: string; name: string | null; email: string }[]
    currentUserId: string
}

export function UserSelector({ users, currentUserId }: UserSelectorProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const handleUserChange = (value: string) => {
        const params = new URLSearchParams(searchParams)
        params.set("userId", value)
        router.push(`?${params.toString()}`)
    }

    if (users.length === 0) return null

    return (
        <Select value={currentUserId} onValueChange={handleUserChange}>
            <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select User" />
            </SelectTrigger>
            <SelectContent>
                {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email} {user.id === currentUserId && "(you)"}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
