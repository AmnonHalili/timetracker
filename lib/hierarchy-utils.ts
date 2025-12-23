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
export function getAllDescendants(userId: string, users: User[]): string[] {
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
 * @returns true if currentUser has permission
 */
export function canManageUser(currentUser: User, targetUser: User): boolean {
    // ADMIN can manage anyone
    if (currentUser.role === "ADMIN") {
        return true
    }

    // MANAGER can manage direct reports
    if (currentUser.role === "MANAGER" && targetUser.managerId === currentUser.id) {
        return true
    }

    return false
}

/**
 * Filter users to only those visible to current user based on hierarchy
 * @param users - All users
 * @param currentUser - User requesting data
 * @returns Filtered array of users
 */
export function filterVisibleUsers(users: User[], currentUser: User): User[] {
    if (currentUser.role === "ADMIN") {
        // ADMIN sees everyone
        return users
    }

    if (currentUser.role === "MANAGER") {
        // MANAGER sees themselves + all descendants
        const visibleIds = new Set([currentUser.id])
        getAllDescendants(currentUser.id, users).forEach(id => visibleIds.add(id))
        return users.filter(u => visibleIds.has(u.id))
    }

    // EMPLOYEE sees only themselves
    return users.filter(u => u.id === currentUser.id)
}
