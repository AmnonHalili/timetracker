import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { TeamList } from "@/components/team/TeamList"
import { AddMemberDialog } from "@/components/team/AddMemberDialog"
import { Button } from "@/components/ui/button"
import { Network } from "lucide-react"
import Link from "next/link"

export default async function TeamPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/login")
    }

    const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { projectId: true, role: true, project: true }
    })

    if (!currentUser?.projectId) {
        return (
            <div className="container mx-auto py-10">
                <h1 className="text-2xl font-bold mb-4">No Project Found</h1>
                <p className="text-muted-foreground">You are not part of any project.</p>
            </div>
        )
    }

    const teamMembers = await prisma.user.findMany({
        where: { projectId: currentUser.projectId },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            image: true,
            dailyTarget: true,
            workDays: true,
            createdAt: true,
        },
        orderBy: { createdAt: "asc" }
    })

    const isManager = ["ADMIN", "MANAGER"].includes(currentUser.role)

    return (
        <div className="container mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
                    <p className="text-muted-foreground">
                        Project: <span className="font-semibold text-foreground">{currentUser.project?.name}</span>
                        <span className="mx-2">•</span>
                        {teamMembers.length} Members
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/team/hierarchy">
                        <Button variant="outline">
                            <Network className="h-4 w-4 mr-2" />
                            View Hierarchy
                        </Button>
                    </Link>
                    {isManager && <AddMemberDialog />}
                </div>
            </div>

            <TeamList users={teamMembers} />
        </div>
    )
}
