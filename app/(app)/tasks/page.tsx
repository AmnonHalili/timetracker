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
    // Fetch Tasks
    const where = isAdmin
        ? { assignees: { some: { projectId: currentUser?.projectId } } }
        : { assignees: { some: { id: session.user.id } } }

    const tasks = await prisma.task.findMany({
        where,
        include: { assignees: true },
        orderBy: { createdAt: "desc" }
    })

    // Fetch Users (Only if admin, for the dropdown)
    // MUST be scoped to the same project
    const users = isAdmin && currentUser?.projectId ? await prisma.user.findMany({
        where: {
            status: "ACTIVE",
            projectId: currentUser.projectId
        },
        select: { id: true, name: true, email: true }
    }) : []

    return (
        <div className="container mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
                    <p className="text-muted-foreground">
                        {isAdmin ? "Manage and assign tasks" : "Your assigned tasks"}
                    </p>
                </div>
                {isAdmin && <CreateTaskDialog users={users} />}
            </div>

            <TasksView initialTasks={tasks} users={users} isAdmin={isAdmin} />
        </div>
    )
}
