import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const { name, email, password, role, managerId } = await req.json()

        if (!name || !email || !password) {
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { projectId: true }
        })

        if (!currentUser?.projectId) {
            return NextResponse.json({ message: "Project not found" }, { status: 404 })
        }

        // Check if email exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        })

        if (existingUser) {
            return NextResponse.json({ message: "Email already exists" }, { status: 400 })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        // Validate managerId if provided
        if (managerId) {
            const manager = await prisma.user.findUnique({
                where: { id: managerId, projectId: currentUser.projectId }
            })
            if (!manager) {
                return NextResponse.json({ message: "Manager not found in this project" }, { status: 400 })
            }
        }

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: role || "EMPLOYEE",
                projectId: currentUser.projectId,
                managerId: managerId || null,
                status: "ACTIVE", // Auto-activate if added by admin/manager
                dailyTarget: 9.0
            }
        })

        // Auto-promote manager to MANAGER if they are currently EMPLOYEE
        if (managerId) {
            const manager = await prisma.user.findUnique({ where: { id: managerId } })
            if (manager && manager.role === "EMPLOYEE") {
                await prisma.user.update({
                    where: { id: managerId },
                    data: { role: "MANAGER" }
                })
            }
        }

        return NextResponse.json({ user: newUser })
    } catch (error) {
        console.error("[CREATE_MEMBER_ERROR]", error)
        return NextResponse.json({ message: "Failed to create member" }, { status: 500 })
    }
}
