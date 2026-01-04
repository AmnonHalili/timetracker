import { unstable_cache } from "next/cache"
import { getValidGoogleClient } from "@/lib/google-calendar"

export const getCachedGoogleEvents = unstable_cache(
    async (userId: string, startIso: string, endIso: string, calendarIds: string[], syncMode: string) => {
        console.log(`[GoogleData] Fetching fresh data for user ${userId}`)
        try {
            const calendar = await getValidGoogleClient(userId)

            const calendarPromises = calendarIds.map(async (calendarId) => {
                try {
                    const googleRes = await calendar.events.list({
                        calendarId,
                        timeMin: startIso,
                        timeMax: endIso,
                        singleEvents: true,
                        orderBy: 'startTime'
                    })

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return (googleRes.data.items || []).map((gEvent: any) => {
                        const isBusyOnly = syncMode === 'BUSY_ONLY'
                        return {
                            id: gEvent.id,
                            title: isBusyOnly ? 'Busy' : (gEvent.summary || '(No Title)'),
                            description: isBusyOnly ? null : gEvent.description,
                            startTime: gEvent.start?.dateTime || gEvent.start?.date,
                            endTime: gEvent.end?.dateTime || gEvent.end?.date,
                            allDay: !gEvent.start?.dateTime,
                            type: 'EXTERNAL',
                            location: isBusyOnly ? null : gEvent.location,
                            isExternal: true,
                            source: 'google',
                            calendarId: calendarId
                        }
                    })
                } catch (err) {
                    console.error(`[GoogleData] Failed to fetch events for calendar ${calendarId}:`, err)
                    return []
                }
            })

            const results = await Promise.all(calendarPromises)
            return results.flat()

        } catch (error) {
            console.error("[GoogleData] Failed to fetch google events:", error)
            return []
        }
    },
    ['google-events-cache'], // Base tag
    {
        revalidate: 300, // Cache for 5 minutes
        tags: ['google-events'] // Tag for manual invalidation if needed later
    }
)
