
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
    // Basic security
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    if (key !== 'migration-secret-123') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const users = await prisma.user.findMany({
            where: {
                projectId: { not: null } // Only users assigned to a project
            }
        })

        const results = {
            total: users.length,
            created: 0,
            errors: 0,
            details: [] as any[]
        }

        for (const user of users) {
            if (!user.projectId) continue

            try {
                // Check if membership already persists
                const existing = await prisma.projectMember.findUnique({
                    where: {
                        userId_projectId: {
                            userId: user.id,
                            projectId: user.projectId
                        }
                    }
                })

                if (!existing) {
                    await prisma.projectMember.create({
                        data: {
                            userId: user.id,
                            projectId: user.projectId,
                            role: user.role, // Assuming Role enum matches
                            status: user.status, // Assuming Status enum matches
                            managerId: user.managerId,
                            workDays: user.workDays,
                            dailyTarget: user.dailyTarget
                        }
                    })
                    results.created++
                }
            } catch (e: any) {
                console.error(`Error migrating user ${user.email}:`, e)
                results.errors++
                results.details.push({ email: user.email, error: e.message })
            }
        }

        return NextResponse.json({ success: true, results })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
