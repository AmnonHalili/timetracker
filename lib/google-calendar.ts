import { google } from "googleapis"
import { prisma } from "@/lib/prisma"

export async function getValidGoogleClient(userId: string) {
    console.log(`[GoogleCalendar] Getting client for user ${userId}`)

    // 1. Get the user's Google account with refresh token
    const account = await prisma.account.findFirst({
        where: {
            userId,
            provider: "google",
        },
    })

    if (!account) {
        console.error(`[GoogleCalendar] No Google account found for user ${userId}`)
        throw new Error("No Google account linked")
    }

    if (!account.refresh_token) {
        console.error(`[GoogleCalendar] No refresh token found for user ${userId}`)
        // Note: In production, you might want to force a re-signin here
        throw new Error("No refresh token available")
    }

    // 2. Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    )

    // 3. Set credentials
    oauth2Client.setCredentials({
        refresh_token: account.refresh_token,
        access_token: account.access_token,
        expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
    })

    // 4. Check if token is expired (or close to expiring) and refresh if needed
    // Google's client handles refresh automatically if refresh_token is present,
    // but we want to capture the new token to update our DB if it changes.

    // We can just return the client. The googleapis library handles the refresh 
    // mechanism automatically when making requests if a refresh_token is set.
    // However, if we want to persist the new access_token, we can listen for events or explicitly refresh.

    // Simple approach: usage will trigger refresh. 
    // To ensure we save updated tokens, we can check expiry manually:
    const isExpired = account.expires_at && (Date.now() > (account.expires_at * 1000 - 60000)); // 1 min buffer

    if (isExpired) {
        console.log(`[GoogleCalendar] Token expired, refreshing...`)
        try {
            const { credentials } = await oauth2Client.refreshAccessToken()

            // Update DB with new tokens
            await prisma.account.update({
                where: { id: account.id },
                data: {
                    access_token: credentials.access_token,
                    expires_at: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : undefined,
                    // refresh_token might be rotated, though usually it sticks for a while
                    refresh_token: credentials.refresh_token ?? account.refresh_token
                }
            })
            console.log(`[GoogleCalendar] Token refreshed and saved.`)
        } catch (error) {
            console.error(`[GoogleCalendar] Failed to refresh token:`, error)
            // If refresh fails (e.g. revoked), we might want to disable sync
            throw new Error("Failed to refresh Google token")
        }
    }

    console.log(`[GoogleCalendar] Client ready.`)
    return google.calendar({ version: "v3", auth: oauth2Client })
}
