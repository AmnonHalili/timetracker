"use client"

import { useEffect, useState } from "react"
import { TeamStatusWidget, TeamMemberStatus } from "@/components/dashboard/TeamStatusWidget"


interface LiveTeamStatusWidgetProps {
    initialStatus?: TeamMemberStatus[]
}

export function LiveTeamStatusWidget({ initialStatus = [] }: LiveTeamStatusWidgetProps) {
    const [teamStatus, setTeamStatus] = useState(initialStatus)
    // Heartbeat is now handled globally by AppLayout -> HeartbeatTracker
    // We don't need to poll generic online status here as this widget fetches detailed team status separately
    // useOnlineStatus() - removed


    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch('/api/team-status')
                if (res.ok) {
                    const data = await res.json()
                    setTeamStatus(data)
                }
            } catch (error) {
                console.error('Failed to fetch team status:', error)
            }
        }

        // Fetch immediately on mount (client-side) to get latest
        fetchStatus()

        const interval = setInterval(fetchStatus, 30000)
        return () => clearInterval(interval)
    }, [])

    return <TeamStatusWidget teamStatus={teamStatus} />
}
