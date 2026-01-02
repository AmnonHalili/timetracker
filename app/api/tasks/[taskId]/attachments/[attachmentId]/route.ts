import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3"

const s3Client = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
})

export async function DELETE(req: Request, { params }: { params: { taskId: string; attachmentId: string } }) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

    try {
        const attachment = await prisma.taskAttachment.findUnique({
            where: { id: params.attachmentId }
        })

        if (!attachment) {
            return NextResponse.json({ message: "Attachment not found" }, { status: 404 })
        }

        // Check ownership or admin/manager role (Simplified: only uploader or admin)
        if (attachment.userId !== session.user.id) {
            // In a real app, check if user is manager of the project
            const user = await prisma.user.findUnique({ where: { id: session.user.id } })
            if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
                return NextResponse.json({ message: "Forbidden" }, { status: 403 })
            }
        }

        // Delete from S3
        await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: attachment.fileKey,
        }))

        // Delete from DB
        await prisma.taskAttachment.delete({
            where: { id: params.attachmentId }
        })

        return NextResponse.json({ message: "Deleted successfully" })
    } catch (error) {
        console.error("Delete Attachment Error:", error)
        return NextResponse.json({ message: "Failed to delete attachment" }, { status: 500 })
    }
}
