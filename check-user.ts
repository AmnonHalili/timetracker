
import { prisma } from "./lib/prisma"

async function main() {
    const email = "amnonhalili@gmail.com"
    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            projectMemberships: {
                include: { project: true }
            },
            project: true
        }
    })

    console.log("User:", user)
    console.log("Memberships:", JSON.stringify(user?.projectMemberships, null, 2))
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
