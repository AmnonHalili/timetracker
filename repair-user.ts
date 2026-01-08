
import { prisma } from "./lib/prisma"

async function main() {
    const email = "amnonhalili@gmail.com"
    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
        console.log("User not found")
        return
    }

    // Check if they need a project
    if (!user.projectId) {
        console.log("Fixing user project...")
        const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase()

        await prisma.$transaction(async (tx) => {
            // Create project
            const project = await tx.project.create({
                data: {
                    name: `${user.name}'s Workspace`,
                    joinCode
                }
            })

            // Add membership
            await tx.projectMember.create({
                data: {
                    userId: user.id,
                    projectId: project.id,
                    role: "ADMIN",
                    status: "ACTIVE"
                }
            })

            // Update user
            await tx.user.update({
                where: { id: user.id },
                data: {
                    projectId: project.id,
                    role: "ADMIN",
                    status: "ACTIVE",
                    jobTitle: "Freelancer"
                }
            })
            console.log("User repaired! Project ID:", project.id)
        })
    } else {
        console.log("User already has a project:", user.projectId)
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
