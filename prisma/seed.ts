import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const password = await hash('password123', 10)

    const admin = await prisma.user.upsert({
        where: { email: 'admin@worktracker.com' },
        update: {},
        create: {
            email: 'admin@worktracker.com',
            name: 'System Admin',
            password,
            role: 'ADMIN',
            status: 'ACTIVE',
        },
    })

    console.log('Admin user created:', admin.email)
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
