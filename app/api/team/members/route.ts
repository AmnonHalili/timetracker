import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Ensure user has a project (is a Manager/Admin)
    const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { projectId: true, role: true }
    })

    if (!currentUser?.projectId || currentUser.role !== "ADMIN") {
        return NextResponse.json({ message: "Forbidden: You must be a Team Admin to add members" }, { status: 403 })
    }

    try {
        const { name, email, password, role } = await req.json()

        if (!name || !email || !password) {
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
        }

        const newRole = role === "ADMIN" ? "ADMIN" : "EMPLOYEE"

        // Check if user exists
        const exists = await prisma.user.findUnique({ where: { email } })
        if (exists) {
            return NextResponse.json({ message: "User with this email already exists" }, { status: 400 })
        }

        const hashedPassword = await hash(password, 10)

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: newRole,
                status: "ACTIVE", // Auto-activate team members added by admin
                projectId: currentUser.projectId,
                workDays: [0, 1, 2, 3, 4], // Sunday to Thursday
                dailyTarget: 8.5,
            }
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userWithoutPassword = { ...newUser } as any
        delete userWithoutPassword.password

        return NextResponse.json({ user: userWithoutPassword }, { status: 201 })
    } catch (error) {
        console.error("Add Member Error:", error)
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 })
    }
}
