import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
})

// GET: List attachments for a task with Presigned URLs
export async function GET(req: Request, { params }: { params: { taskId: string } }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    const attachments = await prisma.taskAttachment.findMany({
        where: { taskId: params.taskId },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, image: true } } }
    })

    // Generate signed URLs for each attachment
    const attachmentsWithSignedUrls = await Promise.all(attachments.map(async (file) => {
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: file.fileKey,
        })
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }) // Valid for 1 hour
        return { ...file, fileUrl: signedUrl }
    }))

    return NextResponse.json(attachmentsWithSignedUrls)
}

// POST: Save attachment metadata after S3 upload
export async function POST(req: Request, { params }: { params: { taskId: string } }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    try {
        const { fileName, fileType, fileKey, fileSize } = await req.json()

        // Store the permanent S3 URL structure in DB, but we will return signed URL in response
        const permanentUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`

        const attachment = await prisma.taskAttachment.create({
            data: {
                taskId: params.taskId,
                userId: session.user.id,
                fileName,
                fileType,
                fileKey,
                fileUrl: permanentUrl,
                fileSize,
            },
            include: { user: { select: { name: true, image: true } } } // Include user for immediate UI update
        })

        // Sign the URL for the immediate response
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: fileKey,
        })
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })

        return NextResponse.json({ ...attachment, fileUrl: signedUrl })
    } catch (error) {
        console.error("Save Attachment Error:", error)
        return NextResponse.json({ message: "Failed to save attachment" }, { status: 500 })
    }
}
