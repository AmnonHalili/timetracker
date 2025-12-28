import { prisma } from "@/lib/prisma"
import { NotificationType } from "@prisma/client"

interface CreateNotificationParams {
    userId: string
    title: string
    message: string
    link?: string
    type?: NotificationType
}

/**
 * Creates a notification in the database.
 * Notifications will be picked up by the notification bell's polling mechanism.
 */
export async function createNotification({
    userId,
    title,
    message,
    link,
    type = "INFO",
}: CreateNotificationParams) {
    try {
        const notification = await prisma.notification.create({
            data: {
                userId,
                title,
                message,
                link,
                type,
            },
        })

        return notification
    } catch (error) {
        console.error("Failed to create notification:", error)
        throw error
    }
}
