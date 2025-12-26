import { User } from "@prisma/client"

export type UserWithEmployees = User & {
    employees: UserWithEmployees[]
}

/**
 * Build hierarchical tree structure from flat list of users
 * @param users - Flat array of users with managerId
 * @returns Array of root nodes (users with no manager)
 */
export function buildHierarchyTree(users: User[]): UserWithEmployees[] {
    // Create a map for quick lookup
    const userMap = new Map<string, UserWithEmployees>()

    // Initialize all users with empty employees array
    users.forEach(user => {
        userMap.set(user.id, { ...user, employees: [] })
    })

    const roots: UserWithEmployees[] = []

    // Build the tree structure
    users.forEach(user => {
        const node = userMap.get(user.id)!

        if (user.managerId) {
            // Add to manager's employees
            const manager = userMap.get(user.managerId)
            if (manager) {
                manager.employees.push(node)
            } else {
                // Manager not found (orphaned user), treat as root
                roots.push(node)
            }
        } else {
            // No manager, this is a root node
            roots.push(node)
        }
    })

    return roots
}

/**
 * Get all descendant user IDs for a given user (recursive)
 * @param userId - ID of user to get descendants for
 * @param users - All users in the system
 * @returns Array of descendant user IDs
 */
export function getAllDescendants<T extends { id: string; managerId: string | null }>(
    userId: string,
    users: T[]
): string[] {
    const descendants: string[] = []
    const directReports = users.filter(u => u.managerId === userId)

    directReports.forEach(report => {
        descendants.push(report.id)
        // Recursively get descendants of this user
        descendants.push(...getAllDescendants(report.id, users))
    })

    return descendants
}

/**
 * Check if assigning employeeId to managerId would create a circular reference
 * @param employeeId - ID of employee being assigned
 * @param managerId - ID of proposed manager
 * @param users - All users in the system
 * @returns true if circular reference would be created
 */
export function detectCircularReference(
    employeeId: string,
    managerId: string,
    users: User[]
): boolean {
    // Can't report to yourself
    if (employeeId === managerId) {
        return true
    }

    // Check if managerId is a descendant of employeeId
    const employeeDescendants = getAllDescendants(employeeId, users)
    return employeeDescendants.includes(managerId)
}

/**
 * Check if currentUser can manage targetUser
 * @param currentUser - User attempting to manage
 * @param targetUser - User being managed
 * @param allUsers - All users in the system (needed for shared chief checks)
 * @returns true if currentUser has permission
 */
export function canManageUser(currentUser: User, targetUser: User, allUsers?: User[]): boolean {
    // Extend User type to include sharedChiefGroupId
    const currentUserExt = currentUser as User & { sharedChiefGroupId?: string | null }
    const targetUserExt = targetUser as User & { sharedChiefGroupId?: string | null }
    const allUsersExt = allUsers as (User & { sharedChiefGroupId?: string | null })[] | undefined

    // Don't allow managing yourself (edge case)
    if (currentUserExt.id === targetUserExt.id) {
        return false
    }

    // ADMIN logic depends on whether they're Independent or Partner
    if (currentUserExt.role === "ADMIN") {
        // Partner Chief (Shared): Can manage employees of any partner in the same group
        if (currentUserExt.sharedChiefGroupId && allUsersExt) {
            const sharedGroupChiefs = allUsersExt.filter(u =>
                u.sharedChiefGroupId === currentUserExt.sharedChiefGroupId &&
                u.role === "ADMIN" &&
                !u.managerId
            )

            // If targetUser reports to any chief in the shared group, currentUser can manage them
            if (targetUserExt.managerId && sharedGroupChiefs.some(chief => chief.id === targetUserExt.managerId)) {
                return true
            }

            // Also check if targetUser is a descendant of any chief in the shared group
            const sharedChiefIds = sharedGroupChiefs.map(c => c.id)
            if (sharedChiefIds.some(chiefId => getAllDescendants(chiefId, allUsersExt!).includes(targetUserExt.id))) {
                return true
            }

            // Cannot manage users outside the shared group
            return false
        }

        // Independent Chief: Can only manage their own descendants
        if (allUsersExt) {
            const myDescendants = getAllDescendants(currentUserExt.id, allUsersExt)
            return myDescendants.includes(targetUserExt.id)
        }

        // Fallback: if no allUsers provided, deny (safer default)
        return false
    }

    // MANAGER can manage direct reports and their descendants
    if (currentUserExt.role === "MANAGER" && allUsersExt) {
        const myDescendants = getAllDescendants(currentUserExt.id, allUsersExt)
        return myDescendants.includes(targetUserExt.id)
    }

    return false
}

/**
 * Filter users to only those visible to current user based on hierarchy
 * @param users - All users
 * @param currentUser - User requesting data (must include sharedChiefGroupId if applicable)
 * @returns Filtered array of users
 */
export function filterVisibleUsers<T extends { id: string, managerId: string | null, sharedChiefGroupId?: string | null, role?: string }>(
    users: T[],
    currentUser: { id: string, role: string, sharedChiefGroupId?: string | null }
): T[] {
    if (currentUser.role === "ADMIN") {
        const visibleIds = new Set([currentUser.id])

        // Add ALL other ADMIN users (chiefs see each other regardless of shared/independent status)
        users.filter(u => u.role === "ADMIN" && !u.managerId).forEach(chief => {
            visibleIds.add(chief.id)
        })

        // Add employees based on shared/independent status
        if (currentUser.sharedChiefGroupId) {
            // Partner Chief: Add all employees under any partner in the same group
            const sharedGroupChiefs = users.filter(u =>
                u.sharedChiefGroupId === currentUser.sharedChiefGroupId &&
                u.role === "ADMIN" &&
                !u.managerId
            ) as T[]

            // Add all descendants of all chiefs in the shared group
            sharedGroupChiefs.forEach(chief => {
                const addDescendants = (parentId: string) => {
                    users.filter(u => u.managerId === parentId).forEach(child => {
                        visibleIds.add(child.id)
                        addDescendants(child.id)
                    })
                }
                addDescendants(chief.id)
            })
        } else {
            // Independent Chief: Add only their own descendants
            const addDescendants = (parentId: string) => {
                users.filter(u => u.managerId === parentId).forEach(child => {
                    visibleIds.add(child.id)
                    addDescendants(child.id)
                })
            }
            addDescendants(currentUser.id)
        }

        return users.filter(u => visibleIds.has(u.id))
    }

    if (currentUser.role === "MANAGER") {
        // MANAGER sees themselves + all descendants
        const visibleIds = new Set([currentUser.id])

        // Simple recursive finder locally to avoid changing everything
        const addDescendants = (parentId: string) => {
            users.filter(u => u.managerId === parentId).forEach(child => {
                visibleIds.add(child.id)
                addDescendants(child.id)
            })
        }

        addDescendants(currentUser.id)
        return users.filter(u => visibleIds.has(u.id))
    }

    // EMPLOYEE sees only themselves
    return users.filter(u => u.id === currentUser.id)
}

/**
 * Check if a user has permission to perform an action on a target user
 * Checks both primary manager relationship and secondary manager permissions
 * @param actorId - ID of user performing the action
 * @param targetUserId - ID of user being acted upon
 * @param action - The permission action (e.g., "VIEW_TIME", "EDIT_SETTINGS")
 * @param allUsers - All users in the system
 * @param secondaryRelations - All secondary manager relationships
 * @returns true if actor has permission, false otherwise
 */
export function checkPermission(
    actorId: string,
    targetUserId: string,
    action: string,
    allUsers: User[],
    secondaryRelations: Array<{ employeeId: string; managerId: string; permissions: string[] }>
): boolean {
    // Don't allow actions on yourself for now (can be customized per action)
    if (actorId === targetUserId) {
        return true // Users can manage themselves
    }

    const actor = allUsers.find(u => u.id === actorId)
    const target = allUsers.find(u => u.id === targetUserId)

    if (!actor || !target) {
        return false
    }

    // 1. Check if actor is primary manager or has admin rights
    if (canManageUser(actor, target, allUsers)) {
        return true
    }

    // 2. Check if actor is secondary manager with specific permission
    const secondaryRel = secondaryRelations.find(
        rel => rel.employeeId === targetUserId && rel.managerId === actorId
    )

    return secondaryRel?.permissions.includes(action) ?? false
}
