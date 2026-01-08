import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3"
import { prisma } from "@/lib/prisma"

const s3Client = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
})

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!

/**
 * Delete all task attachments from S3 for given task IDs
 * @param taskIds Array of task IDs whose attachments should be deleted
 * @returns Number of files deleted
 */
export async function deleteTaskAttachments(taskIds: string[]): Promise<number> {
    if (!BUCKET_NAME || taskIds.length === 0) {
        return 0
    }

    try {
        // Get all attachments for these tasks
        const attachments = await prisma.taskAttachment.findMany({
            where: {
                taskId: { in: taskIds }
            },
            select: {
                fileKey: true
            }
        })

        if (attachments.length === 0) {
            return 0
        }

        // Delete files from S3 in parallel (with error handling)
        const deletePromises = attachments.map(async (attachment) => {
            try {
                await s3Client.send(new DeleteObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: attachment.fileKey,
                }))
                return { success: true, key: attachment.fileKey }
            } catch (error) {
                console.error(`Failed to delete S3 file ${attachment.fileKey}:`, error)
                return { success: false, key: attachment.fileKey, error }
            }
        })

        const results = await Promise.all(deletePromises)
        const successCount = results.filter(r => r.success).length

        if (successCount < attachments.length) {
            console.warn(`Only deleted ${successCount} out of ${attachments.length} files from S3`)
        }

        return successCount
    } catch (error) {
        console.error("Error deleting task attachments from S3:", error)
        throw error
    }
}

/**
 * Find and delete orphaned files in S3 that don't exist in database
 * This is a safety measure to clean up files that might have been missed
 * @returns Number of orphaned files deleted
 */
export async function deleteOrphanedFiles(): Promise<number> {
    if (!BUCKET_NAME) {
        return 0
    }

    try {
        // Get all file keys from database
        const dbAttachments = await prisma.taskAttachment.findMany({
            select: {
                fileKey: true
            }
        })

        const dbFileKeys = new Set(dbAttachments.map(a => a.fileKey))

        // List all files in S3 bucket (in uploads/ prefix)
        let continuationToken: string | undefined
        const orphanedFiles: string[] = []
        // let totalListed = 0 // Unused

        do {
            const listCommand = new ListObjectsV2Command({
                Bucket: BUCKET_NAME,
                Prefix: "uploads/",
                ContinuationToken: continuationToken,
            })

            const response = await s3Client.send(listCommand)

            if (response.Contents) {
                // totalListed += response.Contents.length

                // Find files that don't exist in DB
                const orphaned = response.Contents
                    .filter(obj => obj.Key && !dbFileKeys.has(obj.Key))
                    .map(obj => obj.Key!)

                orphanedFiles.push(...orphaned)
            }

            continuationToken = response.NextContinuationToken
        } while (continuationToken)

        if (orphanedFiles.length === 0) {
            return 0
        }

        // Delete orphaned files (in batches to avoid overwhelming S3)
        const BATCH_SIZE = 50
        let deletedCount = 0

        for (let i = 0; i < orphanedFiles.length; i += BATCH_SIZE) {
            const batch = orphanedFiles.slice(i, i + BATCH_SIZE)

            const deletePromises = batch.map(async (key) => {
                try {
                    await s3Client.send(new DeleteObjectCommand({
                        Bucket: BUCKET_NAME,
                        Key: key,
                    }))
                    return { success: true, key }
                } catch (error) {
                    console.error(`Failed to delete orphaned file ${key}:`, error)
                    return { success: false, key, error }
                }
            })

            const results = await Promise.all(deletePromises)
            deletedCount += results.filter(r => r.success).length
        }

        console.log(`Deleted ${deletedCount} orphaned files out of ${orphanedFiles.length} found`)
        return deletedCount
    } catch (error) {
        console.error("Error deleting orphaned files from S3:", error)
        // Don't throw - this is a cleanup operation, continue even if it fails
        return 0
    }
}
