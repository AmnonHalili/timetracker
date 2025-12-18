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

    // Fetch Tasks
    const where = isAdmin ? {} : { assignedToId: session.user.id }
    const tasks = await prisma.task.findMany({
        where,
        include: { assignedTo: true },
        orderBy: { createdAt: "desc" }
    })

    // Fetch Users (Only if admin, for the dropdown)
    const users = isAdmin ? await prisma.user.findMany({
        where: { status: "ACTIVE" }, // Only active users
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
