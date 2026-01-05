
import { prisma } from "./lib/prisma"

async function verifyIsolation() {
    console.log("Starting Isolation Verification...")

    // 1. Fetch Admin User
    const admin = await prisma.user.findUnique({
        where: { email: "amnonhalili@gmail.com" },
        include: { projectMemberships: { include: { project: true } } }
    })

    if (!admin) {
        console.error("Admin not found")
        return
    }

    const projectId = admin.projectId
    console.log(`User: ${admin.name}, Current Project ID: ${projectId}`)

    if (!projectId) {
        console.error("User has no active project")
        return
    }

    // 2. Fetch Tasks using raw Prisma query (simulating API logic)
    console.log("\nVerifying Task Isolation...")
    const tasks = await prisma.task.findMany({
        where: { projectId: projectId }
    })
    console.log(`Found ${tasks.length} tasks for current project.`)
    tasks.forEach(t => console.log(`- Task: ${t.title} (ProjectID: ${t.projectId})`))

    const leakedTasks = await prisma.task.findMany({
        where: {
            projectId: { not: projectId },
            // Just to see if any exist at all in DB that are NOT part of this project
            // and potentially check if they were accessible before
        },
        take: 5
    })

    console.log(`\nFound ${leakedTasks.length} tasks from OTHER projects (should definitely NOT be visible in app):`)
    leakedTasks.forEach(t => console.log(`- Task: ${t.title} (ProjectID: ${t.projectId})`))

    // 3. Create a Dummy Task to verify Project ID saving
    console.log("\nCreating test task...")
    const newTask = await prisma.task.create({
        data: {
            title: "Isolation Test Task " + new Date().toISOString(),
            projectId: projectId,
            assignees: { connect: { id: admin.id } }
        }
    })
    console.log(`Created Task: ${newTask.title} with Project ID: ${newTask.projectId}`)

    if (newTask.projectId !== projectId) {
        console.error("FAIL: Task created with wrong Project ID!")
    } else {
        console.log("PASS: Task created with correct Project ID.")
    }

    // Cleanup
    await prisma.task.delete({ where: { id: newTask.id } })
    console.log("Test task cleaned up.")
}

verifyIsolation()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
