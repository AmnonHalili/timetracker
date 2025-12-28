"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"

const POLLING_INTERVAL = 30000 // 30 seconds

export function useOnlineStatus() {
    const { data: session } = useSession()
    const [onlineUserIds, setOnlineUserIds] = useState<string[]>([])

    // Poll for online users
    useEffect(() => {
        if (!session?.user?.id) return

        const fetchOnlineUsers = async () => {
            try {
                const res = await fetch('/api/online-status')
                if (res.ok) {
                    const data = await res.json()
                    setOnlineUserIds(data.onlineUsers || [])
                }
            } catch (error) {
                console.error('Failed to fetch online users:', error)
            }
        }

        // Initial fetch
        fetchOnlineUsers()

        // Set interval
        const intervalId = setInterval(fetchOnlineUsers, POLLING_INTERVAL)

        return () => clearInterval(intervalId)
    }, [session])

    // Send heartbeat
    useEffect(() => {
        if (!session?.user?.id) return

        const sendHeartbeat = async () => {
            try {
                await fetch('/api/online-status', { method: 'POST' })
            } catch (error) {
                console.error('Failed to send heartbeat:', error)
            }
        }

        // Initial heartbeat
        sendHeartbeat()

        // Set interval
        const intervalId = setInterval(sendHeartbeat, POLLING_INTERVAL)

        return () => clearInterval(intervalId)
    }, [session])

    return { onlineUserIds }
}
