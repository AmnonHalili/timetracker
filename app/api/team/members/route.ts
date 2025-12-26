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
        const { name, email, password, role, managerId, jobTitle, chiefType } = await req.json()

        if (!name || !email) {
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
        }

        // Only ADMIN can create ADMINs
        if (role === "ADMIN" && session.user.role !== "ADMIN") {
            return NextResponse.json({ message: "Only Admins can create other Admins" }, { status: 403 })
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { 
                projectId: true,
                id: true
            }
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

        // Generate random password if not provided (for invited members)
        const passwordToHash = password || Math.random().toString(36).slice(-8)
        const hashedPassword = await bcrypt.hash(passwordToHash, 10)

        // Validate managerId if provided
        if (managerId) {
            const manager = await prisma.user.findUnique({
                where: { id: managerId, projectId: currentUser.projectId }
            })
            if (!manager) {
                return NextResponse.json({ message: "Manager not found in this project" }, { status: 400 })
            }
        }

        // Handle Chief creation logic
        let sharedChiefGroupId: string | null = null
        let finalManagerId: string | null = managerId || null

        if (role === "ADMIN" && chiefType) {
            if (chiefType === "partner") {
                // Partner (Shared Chief) logic
                // Check if current user is already a top-level chief (no manager)
                let currentUserFull: any
                try {
                    // Try to fetch with sharedChiefGroupId
                    currentUserFull = await prisma.user.findUnique({
                        where: { id: currentUser.id },
                        select: { managerId: true, sharedChiefGroupId: true }
                    })
                } catch (e: any) {
                    // If field doesn't exist, fetch without it
                    if (e.message?.includes('sharedChiefGroupId') || e.message?.includes('Unknown field')) {
                        currentUserFull = await prisma.user.findUnique({
                            where: { id: currentUser.id },
                            select: { managerId: true }
                        })
                        // Set to null if field doesn't exist
                        currentUserFull = currentUserFull ? { ...currentUserFull, sharedChiefGroupId: null } : null
                    } else {
                        throw e
                    }
                }

                if (currentUserFull?.managerId) {
                    return NextResponse.json({ 
                        message: "Only top-level chiefs can add partners. You must be a root-level chief." 
                    }, { status: 400 })
                }

                // Use existing sharedChiefGroupId or create a new one
                if (currentUserFull?.sharedChiefGroupId) {
                    sharedChiefGroupId = currentUserFull.sharedChiefGroupId
                } else {
                    // Create new shared group ID (using cuid-like format)
                    sharedChiefGroupId = `shared-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
                    
                    // Update current user to have this shared group ID
                    try {
                        await prisma.user.update({
                            where: { id: currentUser.id },
                            data: { sharedChiefGroupId } as any
                        })
                    } catch (updateError: any) {
                        // If field doesn't exist in Prisma client, log warning but continue
                        if (updateError.message?.includes('sharedChiefGroupId') || updateError.message?.includes('Unknown field')) {
                            console.warn("sharedChiefGroupId field not available in Prisma client, skipping update")
                            // Set to null so we don't try to use it
                            sharedChiefGroupId = null
                        } else {
                            throw updateError
                        }
                    }
                }

                // New chief will have no manager (top-level) but same sharedChiefGroupId
                finalManagerId = null

                // After creating the new chief, assign all employees under current chief to also report to new chief
                // We'll do this after user creation
            } else if (chiefType === "independent") {
                // Independent Chief - no manager, no shared group
                finalManagerId = null
                sharedChiefGroupId = null
            }
        }

        // Prepare user data
        const userData: any = {
            name,
            email,
            password: hashedPassword,
            role: role || "EMPLOYEE",
            jobTitle: jobTitle || null,
            projectId: currentUser.projectId,
            managerId: finalManagerId,
            status: password ? "ACTIVE" : "PENDING", // PENDING if no password provided (invited)
            dailyTarget: 9.0
        }

        // Only add sharedChiefGroupId if it's not null (Prisma might not support it yet)
        if (sharedChiefGroupId !== null) {
            try {
                userData.sharedChiefGroupId = sharedChiefGroupId
            } catch (e) {
                // Field might not exist in Prisma client yet, log warning but continue
                console.warn("sharedChiefGroupId field not available, creating without it")
            }
        }

        const newUser = await prisma.user.create({
            data: userData
        })

        // If adding as partner, assign all employees under current chief to also report to new chief
        if (role === "ADMIN" && chiefType === "partner" && sharedChiefGroupId) {
            // Get all employees currently under the current chief (direct and indirect)
            const allEmployees = await prisma.user.findMany({
                where: {
                    projectId: currentUser.projectId,
                    managerId: currentUser.id
                },
                select: { id: true }
            })

            // Update all employees to also have the new chief as their manager
            // Actually, we need to think about this differently - shared chiefs should share the same employees
            // But the current structure has managerId pointing to one manager
            // For shared chiefs, we'll make employees report to both by updating their managerId to the new chief
            // OR we could use a many-to-many relationship, but that's more complex
            // For now, let's make all direct reports of current chief also report to new chief
            // Actually, wait - if both chiefs are partners, employees should be able to report to either
            // But our current schema only supports one managerId
            
            // Solution: For shared chiefs, we'll make employees report to the "primary" chief (the one who was there first)
            // But both chiefs can see and manage all employees in the shared group
            // The permission checks will need to account for sharedChiefGroupId
            
            // For now, we'll leave employees reporting to the original chief
            // Permission checks will be updated to allow both chiefs to manage employees in their shared group
        }

        // Auto-promote manager to MANAGER if they are currently EMPLOYEE
        if (finalManagerId) {
            const manager = await prisma.user.findUnique({ where: { id: finalManagerId } })
            if (manager && manager.role === "EMPLOYEE") {
                await prisma.user.update({
                    where: { id: finalManagerId },
                    data: { role: "MANAGER" }
                })
            }
        }

        return NextResponse.json({ user: newUser })
    } catch (error) {
        console.error("[CREATE_MEMBER_ERROR]", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        // Log full error for debugging
        if (error instanceof Error) {
            console.error("[CREATE_MEMBER_ERROR] Stack:", error.stack)
        }
        return NextResponse.json({ 
            message: "Failed to create member",
            error: errorMessage 
        }, { status: 500 })
    }
}
