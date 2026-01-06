import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { TasksPageWithOptimisticUpdate } from "@/components/tasks/TasksPageWithOptimisticUpdate"

export default async function TasksPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/login")
    }

    const isAdmin = session.user.role === "ADMIN"
    const isManager = session.user.role === "MANAGER"

    // Get current user's project ID
    const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { projectId: true, role: true, id: true }
    })

    // Fetch Tasks
    // Strict Project Isolation
    const where: import("@prisma/client").Prisma.TaskWhereInput = {
        projectId: currentUser?.projectId // Ensure task belongs to current project
    }

    // Force strict isolation if:
    // 1. User is not an admin
    // 2. OR User is in Private Session (projectId is null) - Admins shouldn't see other people's private tasks
    if (!isAdmin || !currentUser?.projectId) {
        where.assignees = { some: { id: session.user.id } }
    }

    let tasks
    try {
        // Try to fetch with subtasks (SubTaskItem)
        tasks = await prisma.task.findMany({
            where,
            include: {
                assignees: true,
                watchers: { select: { id: true, name: true, image: true } },
                labels: true,
                blocking: { select: { id: true, title: true, status: true } },
                blockedBy: { select: { id: true, title: true, status: true } },
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
                    watchers: { select: { id: true, name: true, image: true } },
                    labels: true,
                    blocking: { select: { id: true, title: true, status: true } },
                    blockedBy: { select: { id: true, title: true, status: true } },
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

    // Fetch Users (for the assignment dropdown)
    let users: { id: string; name: string | null; email: string | null }[] = []

    if ((isAdmin || isManager) && currentUser?.projectId) {
        const baseUsers = await prisma.user.findMany({
            where: {
                status: "ACTIVE",
                projectId: currentUser.projectId
            },
            select: { id: true, name: true, email: true, managerId: true }
        })

        if (isManager && !isAdmin) {
            // For managers, include:
            // 1. Themselves
            // 2. Their direct reports and descendants  
            // 3. Employees they manage as secondary manager with MANAGE_TASKS
            const secondaryRelations = await prisma.secondaryManager.findMany({
                where: {
                    managerId: currentUser.id,
                    permissions: { has: 'MANAGE_TASKS' }
                },
                select: { employeeId: true }
            })

            const secondaryEmployeeIds = new Set(secondaryRelations.map(rel => rel.employeeId))
            const descendants = new Set([currentUser.id])

            // Add all direct reports and their descendants
            const addDescendants = (userId: string) => {
                baseUsers
                    .filter(u => u.managerId === userId)
                    .forEach(child => {
                        descendants.add(child.id)
                        addDescendants(child.id)
                    })
            }
            addDescendants(currentUser.id)

            // Combine primary and secondary managed employees
            users = baseUsers.filter(u =>
                descendants.has(u.id) || secondaryEmployeeIds.has(u.id)
            )
        } else {
            // Admin sees all project users
            users = baseUsers
        }
    } else {
        // Regular employee can only see themselves
        users = [{ id: session.user.id, name: session.user.name || "Me", email: session.user.email ?? null }]
    }

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
        select: {
            id: true,
            userId: true,
            startTime: true,
            endTime: true,
            description: true,
            isManual: true,
            createdAt: true,
            updatedAt: true,
            subtaskId: true,
            // location fields removed
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
        // Map for main tasks
        entry.tasks.forEach(task => {
            const existing = tasksWithActiveTimers.get(task.id) || []
            // Avoid duplicates
            if (!existing.some(u => u.id === entry.user.id)) {
                existing.push({ id: entry.user.id, name: entry.user.name })
            }
            tasksWithActiveTimers.set(task.id, existing)
        })

        // Map for subtask if exists
        if (entry.subtaskId) {
            const existingSub = tasksWithActiveTimers.get(entry.subtaskId) || []
            if (!existingSub.some(u => u.id === entry.user.id)) {
                existingSub.push({ id: entry.user.id, name: entry.user.name })
            }
            tasksWithActiveTimers.set(entry.subtaskId, existingSub)
        }
    })

    // Fetch Project Labels
    let labels: { id: string; name: string; color: string }[] = []
    if (currentUser?.projectId) {
        labels = await prisma.taskLabel.findMany({
            where: { projectId: currentUser.projectId },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, color: true }
        })
    }

    return (
        <TasksPageWithOptimisticUpdate
            isAdmin={isAdmin || isManager}
            users={users}
            currentUserId={session.user.id}
            initialTasks={tasks}
            tasksWithActiveTimers={Object.fromEntries(tasksWithActiveTimers)}
            labels={labels}
        />
    )
}
