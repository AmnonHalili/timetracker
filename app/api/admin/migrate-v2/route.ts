
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            details: [] as any[]
        }

        for (const user of users) {
            // ...
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            console.error(`Error migrating user ${user.email}:`, e)
            results.errors++
            results.details.push({ email: user.email, error: e.message })
        }
    }

        return NextResponse.json({ success: true, results })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
}
}
