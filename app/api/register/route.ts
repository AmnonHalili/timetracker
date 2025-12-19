import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
    try {
        const { email, password, name, role, projectName } = await req.json()

        if (!email || !password || !name) {
            return NextResponse.json(
                { message: "Missing required fields" },
                { status: 400 }
            )
        }

        const exists = await prisma.user.findUnique({
            where: { email },
        })

        if (exists) {
            return NextResponse.json(
                { message: "User already exists" },
                { status: 400 }
            )
        }

        const hashedPassword = await hash(password, 10)

        // If creating a team (ADMIN)
        let projectId = null
        let userRole = "EMPLOYEE"
        let userStatus = "PENDING"

        if (role === "ADMIN") {
            if (!projectName) {
                return NextResponse.json({ message: "Project Name is required" }, { status: 400 })
            }

            const project = await prisma.project.create({
                data: { name: projectName }
            })
            projectId = project.id
            userRole = "ADMIN"
            userStatus = "ACTIVE" // Auto-approve creator
        }

        // We use 'any' cast for role/status to avoid enum import issues in simple API route if types aren't perfect
        // In a strictly typed env we would import { Role, Status } from '@prisma/client'

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: userRole as any,
                status: userStatus as any,
                projectId,
            },
        })

        const { password: _, ...userWithoutPassword } = user

        return NextResponse.json(
            { message: "User created successfully", user: userWithoutPassword },
            { status: 201 }
        )
    } catch (error) {
        console.error("Registration error:", error)
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        )
    }
}
