import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { TeamList } from "@/components/team/TeamList"
import { TeamOnboardingWidget } from "@/components/dashboard/TeamOnboardingWidget"
import { filterHierarchyGroup } from "@/lib/hierarchy-utils"
import { TeamRequestsList } from "@/components/team/TeamRequestsList"
import { TeamPageHeader } from "@/components/team/TeamPageHeader"
import { TeamInvitationsList } from "@/components/team/TeamInvitationsList"

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

    // Fetch pending invitations for the user
    const pendingInvitations = await prisma.projectMember.findMany({
        where: {
            userId: session.user.id,
            status: "INVITED"
        },
        include: {
            project: {
                select: {
                    id: true,
                    name: true,
                    logo: true
                }
            }
        },
        orderBy: {
            joinedAt: 'desc'
        }
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

                {/* Show invitations if any */}
                {pendingInvitations.length > 0 && (
                    <TeamInvitationsList invitations={pendingInvitations} />
                )}

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
        // Try to fetch with sharedChiefGroupId and removedAt filter
        // Only include ACTIVE users (those who have accepted invitation and signed in)
        // Exclude removed users (removedAt != null)
        allTeamMembers = await prisma.user.findMany({
            where: {
                projectId: currentUser.projectId,
                status: "ACTIVE", // Only show users who have accepted invitation and signed in
                removedAt: null // Exclude removed users
            },
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
        // If removedAt field doesn't exist yet (migration not run), try without it
        try {
            // Try with sharedChiefGroupId but without removedAt
            allTeamMembers = await prisma.user.findMany({
                where: {
                    projectId: currentUser.projectId,
                    status: "ACTIVE" // Only show users who have accepted invitation and signed in
                },
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
                    sharedChiefGroupId: true,
                } as never,
                orderBy: { createdAt: "asc" }
            }) as TeamMember[]
        } catch {
            // If sharedChiefGroupId also doesn't exist, fetch without both
            // Only include ACTIVE users (those who have accepted invitation and signed in)
            const fetchedUsers = await prisma.user.findMany({
                where: {
                    projectId: currentUser.projectId,
                    status: "ACTIVE" // Only show users who have accepted invitation and signed in
                },
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

    // Get current user's managerId for hierarchy group filtering
    const currentUserWithManager = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, managerId: true }
    })

    // Filter to show only users in the hierarchy group:
    // - The user's manager
    // - Siblings (users at the same level under the same manager)
    // - Direct reports (users one level below)
    const hierarchyGroupMembers = currentUserWithManager
        ? filterHierarchyGroup(allTeamMembers, currentUserWithManager)
        : allTeamMembers

    const teamMembers = sortByHierarchy(
        hierarchyGroupMembers,
        session.user.id
    )


    const isManager = ["ADMIN", "MANAGER"].includes(currentUser.role)

    return (
        <div className="container mx-auto space-y-8">
            {/* Show invitations if any */}
            {pendingInvitations.length > 0 && (
                <TeamInvitationsList invitations={pendingInvitations} />
            )}

            {pendingRequests.length > 0 && (
                <TeamRequestsList initialRequests={pendingRequests} />
            )}

            <TeamPageHeader
                projectName={currentUser.project?.name || null}
                membersCount={teamMembers.length}
                isManager={isManager}
            />

            <TeamList
                users={teamMembers as never}
                allUsers={allTeamMembers as never}
                currentUserId={session.user.id}
                currentUserRole={currentUser.role}
            />
        </div>
    )
}
