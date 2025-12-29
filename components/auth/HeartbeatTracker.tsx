"use client"

import { useOnlineStatus } from "@/hooks/useOnlineStatus"

export function HeartbeatTracker() {
    // Only enable heartbeat, disable polling globally
    useOnlineStatus({ enableHeartbeat: true, enablePolling: false })
    return null
}
