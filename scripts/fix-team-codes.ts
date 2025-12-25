
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    const projects = await prisma.project.findMany()

    for (const project of projects) {
        // If code is long (CUID like) or undefined (if that was possible), replace it
        if (project.joinCode.length > 8) {
            const newCode = Math.random().toString(36).substring(2, 8).toUpperCase()
            console.log(`Updating project ${project.name}: ${project.joinCode} -> ${newCode}`)

            await prisma.project.update({
                where: { id: project.id },
                data: { joinCode: newCode }
            })
        }
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
