import { prisma } from "@/lib/prisma"

export type ActivityAction =
    | "STATUS_CHANGE"
    | "PRIORITY_CHANGE"
    | "ASSIGN_USER"
    | "REMOVE_USER"
    | "COMMENT_ADDED"
    | "FILE_UPLOADED"
    | "FILE_DELETED"
    | "TASK_CREATED"
    | "TASK_DELETED"
    | "DEADLINE_CHANGE"
    | "WATCH_TASK"
    | "UNWATCH_TASK"
    | "LABEL_CHANGE"
    | "DEPENDENCY_ADD"
    | "DEPENDENCY_REMOVE"

export async function logActivity(
    taskId: string,
    userId: string,
    action: ActivityAction,
    details?: string
) {
    try {
        await prisma.taskActivity.create({
            data: {
                taskId,
                userId,
                action,
                details
            }
        })
    } catch (error) {
        console.error("Failed to log activity:", error)
        // We generally don't want to fail the main request just because logging failed, 
        // but logging the error is important.
    }
}
