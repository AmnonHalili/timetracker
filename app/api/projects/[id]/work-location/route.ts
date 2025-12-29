import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const project = await prisma.project.findUnique({
            where: { id: params.id },
            select: {
                workLocationLatitude: true,
                workLocationLongitude: true,
                workLocationRadius: true,
                workLocationAddress: true,
                isRemoteWork: true,
            },
        })

        if (!project) {
            return NextResponse.json({ message: "Project not found" }, { status: 404 })
        }

        // Check if user has access to this project
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { projectId: true },
        })

        if (user?.projectId !== params.id) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        // If remote work is enabled, return that
        if (project.isRemoteWork) {
            return NextResponse.json({ location: null, isRemoteWork: true })
        }

        if (!project.workLocationLatitude || !project.workLocationLongitude) {
            return NextResponse.json({ location: null, isRemoteWork: false })
        }

        return NextResponse.json({
            location: {
                latitude: project.workLocationLatitude,
                longitude: project.workLocationLongitude,
                radius: project.workLocationRadius || 150,
                address: project.workLocationAddress,
            },
            isRemoteWork: false,
        })
    } catch (error) {
        console.error("Error fetching work location:", error)
        return NextResponse.json({ message: "Internal Error" }, { status: 500 })
    }
}

export async function PUT(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions)
    if (!session) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { projectId: true, role: true },
        })

        if (!user || user.projectId !== params.id) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 })
        }

        // Only ADMIN can update work location
        if (user.role !== "ADMIN") {
            return NextResponse.json({ message: "Only admins can update work location" }, { status: 403 })
        }

        const { location, isRemoteWork } = await req.json()
        
        // Handle remote work setting
        if (isRemoteWork !== undefined) {
            await prisma.project.update({
                where: { id: params.id },
                data: {
                    isRemoteWork,
                    // If enabling remote work, clear location
                    ...(isRemoteWork ? {
                        workLocationLatitude: null,
                        workLocationLongitude: null,
                        workLocationRadius: null,
                        workLocationAddress: null,
                    } : {}),
                },
            })
            return NextResponse.json({ success: true, isRemoteWork, location: null })
        }

        const { latitude, longitude, radius, address } = location || {}

        if (latitude === null || longitude === null) {
            // Remove work location
            await prisma.project.update({
                where: { id: params.id },
                data: {
                    workLocationLatitude: null,
                    workLocationLongitude: null,
                    workLocationRadius: null,
                    workLocationAddress: null,
                    isRemoteWork: false, // If removing location, disable remote work
                },
            })
            return NextResponse.json({ success: true, location: null, isRemoteWork: false })
        }

        if (typeof latitude !== "number" || typeof longitude !== "number") {
            return NextResponse.json({ message: "Invalid coordinates" }, { status: 400 })
        }

        if (radius && (radius < 50 || radius > 300)) {
            return NextResponse.json({ message: "Radius must be between 50 and 300 meters" }, { status: 400 })
        }

        const project = await prisma.project.update({
            where: { id: params.id },
            data: {
                workLocationLatitude: latitude,
                workLocationLongitude: longitude,
                workLocationRadius: radius || 150,
                workLocationAddress: address || null,
                isRemoteWork: false, // If setting location, disable remote work
            },
        })

        return NextResponse.json({
            success: true,
            location: {
                latitude: project.workLocationLatitude,
                longitude: project.workLocationLongitude,
                radius: project.workLocationRadius,
                address: project.workLocationAddress,
            },
            isRemoteWork: project.isRemoteWork,
        })
    } catch (error) {
        console.error("Error updating work location:", error)
        return NextResponse.json({ message: "Internal Error" }, { status: 500 })
    }
}

