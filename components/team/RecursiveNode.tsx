"use client"

import { User } from "@prisma/client"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useSession } from "next-auth/react"
import { getAllDescendants } from "@/lib/hierarchy-utils"
import { useLanguage } from "@/lib/useLanguage"

interface RecursiveNodeProps {
    node: User & { children?: RecursiveNodeProps['node'][] }
    allUsers: User[] // Passed down for the Add dialog context
    onAddClick?: (parentId: string, parentName: string) => void
    depth?: number
    hideConnectorLines?: boolean // Hide horizontal connector lines (used for shared partners children)
    onlineUserIds?: string[] // List of currently online user IDs
}

export function RecursiveNode({ node, allUsers, onAddClick, depth = 0, hideConnectorLines = false, onlineUserIds = [] }: RecursiveNodeProps) {
    const { data: session } = useSession()
    const { t } = useLanguage()
    const hasChildren = node.children && node.children.length > 0
    const isCurrentUser = session?.user?.id === node.id
    const isOnline = onlineUserIds.includes(node.id)

    return (
        <div className="flex flex-col items-center" dir="ltr">
            {/* User Card */}
            <div
                id={`node-${node.id}`}
                className={cn(
                    "relative group flex flex-col items-start p-4 rounded-lg border text-card-foreground shadow-sm w-[220px] transition-all",
                    isCurrentUser
                        ? "bg-primary/10 border-primary shadow-md ring-1 ring-primary/20"
                        : "bg-card hover:shadow-md border-border"
                )}>
                {/* Header/Role Color Indicator */}
                <div className={cn(
                    "absolute top-0 left-0 w-1 h-full rounded-l-lg",
                    node.role === 'ADMIN' ? "bg-black dark:bg-white" :
                        hasChildren ? "bg-amber-700" : "bg-green-500"
                )} />

                <div className="pl-3 flex items-center gap-3 w-full">
                    <div className="relative">
                        <Avatar className="h-10 w-10 border border-border/50">
                            <AvatarImage src={node.image || undefined} alt={node.name} />
                            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                                {node.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        {/* Online Status Badge - only show for other users */}
                        {!isCurrentUser && (
                            <div className="absolute bottom-0 right-0 z-10">
                                <div className={cn(
                                    "h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-900 transition-colors",
                                    isOnline
                                        ? "bg-green-500 shadow-lg shadow-green-500/50"
                                        : "bg-gray-400"
                                )} />
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col overflow-hidden">
                        <div className="font-semibold truncate text-sm" title={node.name}>{node.name}</div>
                        <div className="text-[10px] text-muted-foreground capitalize leading-tight">
                            {(() => {
                                // If user has a jobTitle, use it
                                if (node.jobTitle) return node.jobTitle
                                // Default to "Company Owner" for ADMIN users (translated)
                                if (node.role === "ADMIN") return t('team.companyOwner')
                                // Otherwise fall back to role
                                return node.role.toLowerCase().replace('_', ' ')
                            })()}
                        </div>
                    </div>
                </div>

                {/* Add Button - Bottom Right */}
                {(() => {
                    if (!session?.user || !onAddClick) return null
                    if (session.user.role === "ADMIN") return (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onAddClick(node.id, node.name)
                            }}
                            className="absolute bottom-1 right-1 p-1 hover:bg-muted rounded-full text-muted-foreground hover:text-primary transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    )

                    if (session.user.role === "MANAGER") {
                        // Manager can add to themselves
                        if (node.id === session.user.id) {
                            return (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onAddClick(node.id, node.name)
                                    }}
                                    className="absolute bottom-1 right-1 p-1 hover:bg-muted rounded-full text-muted-foreground hover:text-primary transition-colors"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                            )
                        }

                        // Manager can add to their descendants
                        // We need access to all users to calculate descendants.
                        // Assuming allUsers is passed and complete (which it is now).
                        // Note: getAllDescendants might be expensive to run for every node in a large tree inside render.
                        // But for typical team size it's fine.
                        // To optimize, we could memoize or check logic simpler: 
                        // If node is in my subtree. 

                        const descendants = getAllDescendants(session.user.id, allUsers)
                        if (descendants.includes(node.id)) {
                            return (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onAddClick(node.id, node.name)
                                    }}
                                    className="absolute bottom-1 right-1 p-1 hover:bg-muted rounded-full text-muted-foreground hover:text-primary transition-colors"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                            )
                        }
                    }

                    return null
                })()}
            </div>



            {/* 
                Recursive Children Rendering 
                We render children in a horizontal row 
            */}
            {hasChildren && (
                <div className="flex items-start gap-4 mt-8 relative">
                    {/* Central Stem from Parent down to the bus line height */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 h-8 w-[2px] bg-slate-300 dark:bg-slate-600" />

                    {/* 
                        Connector Lines Wrapper
                        We need a horizontal line connecting the center of the first child to the center of the last child 
                    */}
                    {node.children!.length > 1 && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[calc(100%-200px)] h-[2px] bg-slate-300 dark:bg-slate-600 hidden" />
                    )}

                    {node.children!.map((child, index) => (
                        <div key={child.id} className="flex flex-col items-center relative">
                            {/* Horizontal Connector Part */}
                            {!hideConnectorLines && node.children!.length > 1 && (
                                <div
                                    className={cn(
                                        "absolute top-0 h-[2px] bg-slate-300 dark:bg-slate-600",
                                        index === 0 ? "left-1/2" : "left-0"
                                    )}
                                    style={{
                                        width: index === 0 ? "calc(50% + 1rem)" :
                                            index === node.children!.length - 1 ? "50%" :
                                                "calc(100% + 1rem)"
                                    }}
                                />
                            )}

                            {/* Vertical connection to child */}
                            <div className="h-8 w-[1px] bg-slate-300 dark:bg-slate-600" />

                            <RecursiveNode
                                key={child.id}
                                node={child}
                                allUsers={allUsers}
                                onAddClick={onAddClick}
                                depth={depth + 1}
                                hideConnectorLines={hideConnectorLines}
                                onlineUserIds={onlineUserIds}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
