import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== "ADMIN") {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const { userId, parentId } = await req.json()

        if (!userId) {
            return NextResponse.json({ message: "User ID is required" }, { status: 400 })
        }

        // Prevent self-assignment
        if (userId === parentId) {
            return NextResponse.json({ message: "Cannot report to self" }, { status: 400 })
        }

        // Circular dependency check
        if (parentId) {
            let current = await prisma.user.findUnique({ where: { id: parentId } })
            while (current?.managerId) {
                if (current.managerId === userId) {
                    return NextResponse.json({ message: "Circular reference detected" }, { status: 400 })
                }
                current = await prisma.user.findUnique({ where: { id: current.managerId } })
            }
        }

        // Update user
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                managerId: parentId,
            }
        })

        // Auto-promote parent to MANAGER if they are currently EMPLOYEE
        if (parentId) {
            const parent = await prisma.user.findUnique({ where: { id: parentId } })
            if (parent && parent.role === "EMPLOYEE") {
                await prisma.user.update({
                    where: { id: parentId },
                    data: { role: "MANAGER" }
                })
            }
        }

        return NextResponse.json({ user: updatedUser })
    } catch (error) {
        console.error("[ASSIGN_PARENT_ERROR]", error)
        return NextResponse.json({ message: "Failed to assign parent" }, { status: 500 })
    }
}
