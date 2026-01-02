import { authOptions } from "@/lib/auth"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { prisma } from "@/lib/prisma"

// Validate Env Vars
if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET_NAME) {
    console.error("Missing AWS Environment Variables")
}

const s3Client = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
})

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { plan: true }
        })

        if (!user || user.plan === 'FREE') {
            return NextResponse.json({ message: "Uploads are restricted to premium plans" }, { status: 403 })
        }

        const { fileName, fileType, fileSize, taskId } = await req.json()

        // Validate file size (e.g., 5MB limit)
        if (fileSize > 5 * 1024 * 1024) {
            return NextResponse.json({ message: "File size too large (Max 5MB)" }, { status: 400 })
        }

        const fileKey = `uploads/${taskId || 'general'}/${Date.now()}-${fileName}`

        const command = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: fileKey,
            ContentType: fileType,
            // ACL: 'public-read', // Depends on bucket settings. If private, don't use this.
        })

        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })

        return NextResponse.json({ url: signedUrl, key: fileKey })
    } catch (error) {
        console.error("Presigned URL Error:", error)
        return NextResponse.json({ message: "Failed to generate upload URL" }, { status: 500 })
    }
}
