
import { prisma } from "./lib/prisma"

async function main() {
    const email = "amnonhalili@gmail.com"
    console.log(`Checking user: ${email}`)

    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            projectMemberships: {
                include: {
                    project: true
                }
            },
            project: true
        }
    })

    if (!user) {
        console.log("User not found")
        return
    }

    console.log(`User ID: ${user.id}`)
    console.log(`User Name: ${user.name}`)
    console.log(`Direct Project ID (user.projectId): ${user.projectId}`)
    console.log(`Direct Project Name: ${user.project?.name}`)

    console.log("Memberships:")
    if (user.projectMemberships.length === 0) {
        console.log("  No memberships found.")
    } else {
        user.projectMemberships.forEach(m => {
            console.log(`  - Project: ${m.project.name} (ID: ${m.projectId}), Role: ${m.role}`)
        })
    }

    if (user.projectId && !user.projectMemberships.find(m => m.projectId === user.projectId)) {
        console.log("MISMATCH DETECTED: User has a projectId but is not a member of that project!")
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
