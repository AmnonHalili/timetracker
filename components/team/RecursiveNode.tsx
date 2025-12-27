"use client"

import { User } from "@prisma/client"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useSession } from "next-auth/react"
import { getAllDescendants } from "@/lib/hierarchy-utils"

interface RecursiveNodeProps {
    node: User & { children?: RecursiveNodeProps['node'][] }
    allUsers: User[] // Passed down for the Add dialog context
    onAddClick?: (parentId: string, parentName: string) => void
    depth?: number
    hideConnectorLines?: boolean // Hide horizontal connector lines (used for shared partners children)
}

export function RecursiveNode({ node, allUsers, onAddClick, depth = 0, hideConnectorLines = false }: RecursiveNodeProps) {
    const { data: session } = useSession()
    const hasChildren = node.children && node.children.length > 0
    const isCurrentUser = session?.user?.id === node.id

    return (
        <div className="flex flex-col items-center">
            {/* Connection Line from Parent to current Node */}
            {depth > 0 && (
                <div className={cn(
                    "h-8 w-px mb-0 relative transition-colors",
                    isCurrentUser ? "bg-primary" : "bg-border group-hover:bg-primary/50"
                )} />
            )}

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
                    <Avatar className="h-10 w-10 border border-border/50">
                        <AvatarImage src={node.image || undefined} alt={node.name} />
                        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                            {node.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex flex-col overflow-hidden">
                        <div className="font-semibold truncate text-sm" title={node.name}>{node.name}</div>
                        <div className="text-[10px] text-muted-foreground capitalize leading-tight">
                            {(() => {
                                // If user has a jobTitle, use it
                                if (node.jobTitle) return node.jobTitle
                                // Default to "Founder" for ADMIN users
                                if (node.role === "ADMIN") return "Founder"
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
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 h-8 w-px bg-border" />

                    {/* 
                        Connector Lines Wrapper
                        We need a horizontal line connecting the center of the first child to the center of the last child 
                    */}
                    {node.children!.length > 1 && (
                        <div className="absolute top-[-1px] left-1/2 -translate-x-1/2 w-[calc(100%-200px)] h-px bg-border hidden" />
                        // Calculating width dynamically in CSS is hard. 
                        // Simpler approach: Each child draws a line up to a common horizontal track.
                    )}

                    {node.children!.map((child, index) => (
                        <div key={child.id} className="flex flex-col items-center relative">
                            {/* Horizontal Connector Part */}
                            {/* 
                                This part represents the horizontal branch.
                                If multiple children, we need a horizontal line spanning from first to last child.
                                
                                CSS Trick: 
                                ::before = vertical line up
                                ::after = horizontal line 
                            */}

                            {/* Connector Logic:
                                1. Vertical line from Parent bottom to 'bus'. (Handled by parent above)
                                2. 'Bus' horizontal line.
                                3. Vertical line from 'bus' to Child top.
                            */}

                            {/* VISUAL HACK: 
                                 Draw a horizontal line above this child if it's not the only child.
                                 And connect it to the parent.
                             */}

                            {!hideConnectorLines && node.children!.length > 1 && (
                                <div className={cn(
                                    "absolute top-[-2rem] h-px bg-border",
                                    index === 0 ? "left-1/2 w-1/2" :
                                        index === node.children!.length - 1 ? "right-1/2 w-1/2" : "w-full"
                                )} />
                            )}

                            {/* Vertical connection to child */}
                            <div className="h-8 w-px bg-border" />

                            <RecursiveNode
                                key={child.id}
                                node={child}
                                allUsers={allUsers}
                                onAddClick={onAddClick}
                                depth={depth + 1}
                                hideConnectorLines={hideConnectorLines}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
