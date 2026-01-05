
import { prisma } from "./lib/prisma"

async function checkUserProjects() {
    const email = "amnonhalili@gmail.com"
    console.log(`Fetching projects for user: ${email}...`)

    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            projectMemberships: {
                include: {
                    project: true
                }
            }
        }
    })

    if (!user) {
        console.log("User not found")
        return
    }

    console.log(`Found user: ${user.name} (${user.id})`)
    console.log(`Total Project Memberships: ${user.projectMemberships.length}`)

    if (user.projectMemberships.length > 0) {
        console.log("\nProjects:")
        user.projectMemberships.forEach(pm => {
            console.log(`- Project: ${pm.project.name} (ID: ${pm.project.id})`)
            console.log(`  Role: ${pm.role}`)
            console.log(`  Status: ${pm.status}`)
            console.log(`  Joined At: ${pm.joinedAt}`)
            console.log("---")
        })
    } else {
        console.log("User is not a member of any projects.")
    }
}

checkUserProjects()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
