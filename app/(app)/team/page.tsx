import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { TeamList } from "@/components/team/TeamList"
import { TeamOnboardingWidget } from "@/components/dashboard/TeamOnboardingWidget"
import { AddMemberDialog } from "@/components/team/AddMemberDialog"
import { filterVisibleUsers } from "@/lib/hierarchy-utils"
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
        select: { projectId: true, role: true, project: true, id: true }
    })

    if (!currentUser?.projectId) {
        // Fetch full user details for the private view
        const privateUser = await prisma.user.findUnique({
            where: { id: session.user.id },
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
                jobTitle: true,
                managerId: true,
            }
        })

        return (
            <div className="container mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Private Session</h1>
                    <p className="text-muted-foreground">You are currently working independently.</p>
                </div>

                <TeamOnboardingWidget />

                {privateUser && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold">Your Profile</h2>
                        <TeamList users={[privateUser]} currentUserId={session.user.id} currentUserRole={privateUser.role} />
                    </div>
                )}
            </div>
        )
    }

    const allTeamMembers = await prisma.user.findMany({
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
            jobTitle: true,
            managerId: true, // Needed for hierarchy
        },
        orderBy: { createdAt: "asc" }
    })

    const teamMembers = filterVisibleUsers(allTeamMembers, currentUser).sort((a, b) => {
        const roleOrder: Record<string, number> = { 'ADMIN': 0, 'MANAGER': 1, 'EMPLOYEE': 2 }
        const roleDiff = (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99)

        if (roleDiff !== 0) return roleDiff
        return a.name.localeCompare(b.name)
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

            <TeamList users={teamMembers} currentUserId={session.user.id} currentUserRole={currentUser.role} />
        </div>
    )
}
