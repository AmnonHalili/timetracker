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
import { TeamRequestsList } from "@/components/team/TeamRequestsList"

export default async function TeamPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/login")
    }

    let currentUser
    try {
        // Try to fetch with sharedChiefGroupId
        currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { projectId: true, role: true, project: true, id: true, sharedChiefGroupId: true } as never
        }) as { projectId: string | null; role: string; project: { id: string; name: string } | null; id: string; sharedChiefGroupId?: string | null } | null
    } catch {
        // If field doesn't exist, fetch without it
        const basicUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { projectId: true, role: true, project: true, id: true }
        })
        currentUser = basicUser ? { ...basicUser, sharedChiefGroupId: null } : null
    }

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

    type TeamMember = {
        id: string
        name: string | null
        email: string
        role: string
        status: string
        image: string | null
        dailyTarget: number | null
        workDays: number[]
        createdAt: Date
        jobTitle: string | null
        managerId: string | null
        sharedChiefGroupId?: string | null
    }

    let allTeamMembers: TeamMember[]
    try {
        // Try to fetch with sharedChiefGroupId
        allTeamMembers = await prisma.user.findMany({
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
                managerId: true,
                sharedChiefGroupId: true, // CRITICAL for filterVisibleUsers!
            } as never,
            orderBy: { createdAt: "asc" }
        }) as TeamMember[]
    } catch {
        // If field doesn't exist, fetch without it and add null
        const fetchedUsers = await prisma.user.findMany({
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
                managerId: true,
            },
            orderBy: { createdAt: "asc" }
        })
        allTeamMembers = fetchedUsers.map(u => ({ ...u, sharedChiefGroupId: null as string | null }))
    }

    // Function to sort users by hierarchy level order (level by level)
    const sortByHierarchy = (users: typeof allTeamMembers, currentUserId: string) => {
        if (users.length === 0) return users

        // Separate current user from others
        const currentUserIndex = users.findIndex(u => u.id === currentUserId)
        const currentUserObj = currentUserIndex >= 0 ? users[currentUserIndex] : null
        const otherUsers = users.filter(u => u.id !== currentUserId)

        if (otherUsers.length === 0) {
            return currentUserObj ? [currentUserObj] : []
        }

        // Build a map for quick lookup
        const userMap = new Map(otherUsers.map(u => [u.id, u]))
        const userLevelMap = new Map<string, number>()

        // Calculate level for each user (0 = root/no manager, 1 = reports to root, etc.)
        const calculateLevel = (userId: string): number => {
            if (userLevelMap.has(userId)) {
                return userLevelMap.get(userId)!
            }
            const user = userMap.get(userId)
            if (!user || !user.managerId || !userMap.has(user.managerId)) {
                // Root level (no manager or manager not in list)
                userLevelMap.set(userId, 0)
                return 0
            }
            // Level is parent's level + 1
            const level = calculateLevel(user.managerId) + 1
            userLevelMap.set(userId, level)
            return level
        }

        // Calculate levels for all users
        otherUsers.forEach(user => calculateLevel(user.id))

        // Sort by level first, then by role, then by name
        const sorted = otherUsers.sort((a, b) => {
            const levelA = userLevelMap.get(a.id) ?? 0
            const levelB = userLevelMap.get(b.id) ?? 0

            // First sort by level (0, 1, 2, ...)
            if (levelA !== levelB) {
                return levelA - levelB
            }

            // Within the same level, sort by role
            const roleOrder: Record<string, number> = { 'ADMIN': 0, 'MANAGER': 1, 'EMPLOYEE': 2 }
            const roleDiff = (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99)
            if (roleDiff !== 0) return roleDiff

            // Within the same role, sort by name
            return (a.name || '').localeCompare(b.name || '')
        })

        // Put current user at the top
        return currentUserObj ? [currentUserObj, ...sorted] : sorted
    }

    // Fetch pending join requests (only if currentUser is ADMIN)
    // We can fetch this in parallel with other data, or just fetch it here.
    // For simplicity, let's fetch it if the user is an admin.
    let pendingRequests: {
        id: string
        name: string
        email: string
        image: string | null
        createdAt: Date
    }[] = []
    if (currentUser.role === "ADMIN") {
        pendingRequests = await prisma.user.findMany({
            where: {
                pendingProjectId: currentUser.projectId
            },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                createdAt: true
            },
            orderBy: { createdAt: "desc" }
        })
    }

    const teamMembers = sortByHierarchy(
        filterVisibleUsers(allTeamMembers, currentUser),
        session.user.id
    )


    const isManager = ["ADMIN", "MANAGER"].includes(currentUser.role)

    return (
        <div className="container mx-auto space-y-8">
            {pendingRequests.length > 0 && (
                <TeamRequestsList initialRequests={pendingRequests} />
            )}

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

            <TeamList users={teamMembers as never} currentUserId={session.user.id} currentUserRole={currentUser.role} />
        </div>
    )
}
