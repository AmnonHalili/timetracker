
import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

async function resetPassword() {
    // 1. Get arguments from command line
    const email = process.argv[2]
    const newPassword = process.argv[3]

    if (!email || !newPassword) {
        console.error("Usage: npx ts-node scripts/reset-password.ts <email> <newPassword>")
        process.exit(1)
    }

    console.log(`Resetting password for user: ${email}`)

    // 2. Hash the new password
    const hashedPassword = await hash(newPassword, 12)

    // 3. Update the user
    try {
        const user = await prisma.user.update({
            where: { email: email.toLowerCase() },
            data: {
                password: hashedPassword,
            },
        })

        console.log(`✅ Password updated successfully for ${user.email}`)
    } catch (error) {
        console.error("❌ Error updating password. Make sure the email exists.")
        console.error(error)
    } finally {
        await prisma.$disconnect()
    }
}

resetPassword()
