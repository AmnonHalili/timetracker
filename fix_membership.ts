
import { prisma } from "./lib/prisma"

async function main() {
    const userId = "cmjvdbyan0001rwawsyjvmohw" // Amnon Halili
    const projectId = "cmjr3tus40002500vaq453s1e" // Flaminga

    console.log(`Fixing membership for user ${userId} in project ${projectId}...`)

    const existing = await prisma.projectMember.findUnique({
        where: {
            userId_projectId: {
                userId,
                projectId
            }
        }
    })

    if (existing) {
        console.log("Membership already exists.")
        return
    }

    const membership = await prisma.projectMember.create({
        data: {
            userId,
            projectId,
            role: 'ADMIN',
            status: 'ACTIVE'
        }
    })

    console.log(`Created membership: ID ${membership.id}, Role ${membership.role}`)
    console.log("Done.")
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
