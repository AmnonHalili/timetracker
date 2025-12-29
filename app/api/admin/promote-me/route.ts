import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)

        if (!session || !session.user?.email) {
            return NextResponse.json({ message: "Not authenticated" }, { status: 401 })
        }

        const userEmail = session.user.email

        // 1. Fetch current DB state
        const dbUser = await prisma.user.findUnique({
            where: { email: userEmail },
            select: { id: true, email: true, role: true, name: true }
        })

        if (!dbUser) {
            return NextResponse.json({ message: "User not found in DB" }, { status: 404 })
        }

        // 2. Check for 'promote' flag
        const { searchParams } = new URL(req.url)
        const shouldPromote = searchParams.get("force") === "true"

        if (shouldPromote) {
            // Update to ADMIN
            const updatedUser = await prisma.user.update({
                where: { email: userEmail },
                data: { role: "ADMIN" }
            })

            return NextResponse.json({
                message: "SUCCESS: User promoted to ADMIN",
                previousData: dbUser,
                newData: {
                    role: updatedUser.role,
                    email: updatedUser.email
                },
                sessionData: {
                    role: session.user.role, // This will show what the session currently thinks
                    note: "You must Log Out and Log In again for the session to reflect this change."
                }
            })
        }

        // 3. Status Report
        return NextResponse.json({
            message: "Diagnostics Report",
            databaseRecord: dbUser,
            currentSession: {
                role: session.user.role,
                isAuthenticated: true
            },
            mismatch: dbUser.role !== session.user.role,
            instruction: "To force upgrade to ADMIN, add ?force=true to the URL"
        })

    } catch (error) {
        console.error("Promote Error:", error)
        return NextResponse.json({ message: "Internal Error", error: String(error) }, { status: 500 })
    }
}
