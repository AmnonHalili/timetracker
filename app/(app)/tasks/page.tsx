import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog"
import { TasksView } from "@/components/tasks/TasksView"

export default async function TasksPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/login")
    }

    const isAdmin = session.user.role === "ADMIN"

    // Get current user's project ID
    const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { projectId: true }
    })

    // Fetch Tasks
    const where = isAdmin
        ? { assignees: { some: { projectId: currentUser?.projectId } } }
        : { assignees: { some: { id: session.user.id } } }

    let tasks
    try {
        // Try to fetch with subtasks (SubTaskItem)
        tasks = await prisma.task.findMany({
            where,
            include: {
                assignees: true,
                checklist: { orderBy: { createdAt: 'asc' } },
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                subtasks: {
                    orderBy: { createdAt: 'asc' }
                }
            },
            orderBy: { createdAt: "desc" }
        })
    } catch (e: unknown) {
        // If subtasks relation doesn't exist, fetch without it
        const errorMessage = e instanceof Error ? e.message : String(e)
        if (errorMessage.includes('subtasks') || errorMessage.includes('Unknown argument') || errorMessage.includes('SubTaskItem')) {
            console.warn("subtasks relation not available, fetching without it")
            tasks = await prisma.task.findMany({
                where,
                include: {
                    assignees: true,
                    checklist: { orderBy: { createdAt: 'asc' } }
                },
                orderBy: { createdAt: "desc" }
            })
            // Add empty subtasks array to each task
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tasks = tasks.map((task: any) => ({ ...task, subtasks: [] }))
        } else {
            throw e
        }
    }

    // Fetch Users (Only if admin, for the dropdown)
    // MUST be scoped to the same project
    // List of users available for assignment
    const users = isAdmin && currentUser?.projectId ? await prisma.user.findMany({
        where: {
            status: "ACTIVE",
            projectId: currentUser.projectId
        },
        select: { id: true, name: true, email: true }
    }) : [{ id: session.user.id, name: session.user.name || "Me", email: session.user.email ?? null }]

    // Fetch active time entries (timers that are currently running) to determine task status
    const activeTimeEntries = await prisma.timeEntry.findMany({
        where: {
            endTime: null, // Active timer
            tasks: {
                some: {
                    id: { in: tasks.map(t => t.id) }
                }
            }
        },
        include: {
            tasks: {
                select: { id: true }
            },
            user: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    })

    // Create a map of task IDs to users who are actively working on them
    const tasksWithActiveTimers = new Map<string, Array<{ id: string; name: string | null }>>()
    activeTimeEntries.forEach(entry => {
        entry.tasks.forEach(task => {
            const existing = tasksWithActiveTimers.get(task.id) || []
            // Avoid duplicates
            if (!existing.some(u => u.id === entry.user.id)) {
                existing.push({ id: entry.user.id, name: entry.user.name })
            }
            tasksWithActiveTimers.set(task.id, existing)
        })
    })

    return (
        <div className="container mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
                    <p className="text-muted-foreground">
                        {isAdmin ? "Manage and assign tasks" : "Your assigned tasks"}
                    </p>
                </div>
                <CreateTaskDialog users={isAdmin && users.length > 0 ? users : [{ id: session.user.id, name: session.user.name || "Me", email: session.user.email ?? null }]} />
            </div>

            <TasksView
                initialTasks={tasks}
                users={users}
                isAdmin={isAdmin}
                currentUserId={session.user.id}
                tasksWithActiveTimers={Object.fromEntries(tasksWithActiveTimers)}
            />
        </div>
    )
}
