
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    const email = "amnonhalili@gmail.com"
    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
        console.log("User not found")
        return
    }

    console.log(`Found user ${user.id}`)

    const deleted = await prisma.account.deleteMany({
        where: {
            userId: user.id,
            provider: "google"
        }
    })

    console.log(`Deleted ${deleted.count} Google account(s) for user.`)
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
