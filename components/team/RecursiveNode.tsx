"use client"

import { User } from "@prisma/client"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface RecursiveNodeProps {
    node: User & { children?: RecursiveNodeProps['node'][] }
    allUsers: User[] // Passed down for the Add dialog context
    onAddClick: (parentId: string, parentName: string) => void
    depth?: number
    isLast?: boolean
}

export function RecursiveNode({ node, allUsers, onAddClick, depth = 0, isLast = false }: RecursiveNodeProps) {
    const hasChildren = node.children && node.children.length > 0

    return (
        <div className="flex flex-col items-center">
            {/* Connection Line from Parent to current Node */}
            {depth > 0 && (
                <div className="h-8 w-px bg-border mb-0 relative group-hover:bg-primary/50 transition-colors" />
            )}

            {/* User Card */}
            <div className={cn(
                "relative group flex flex-col items-start p-4 rounded-lg border bg-card text-card-foreground shadow-sm w-[220px] hover:shadow-md transition-all"
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
                            {(node as any).jobTitle ? (node as any).jobTitle : node.role.toLowerCase().replace('_', ' ')}
                        </div>
                    </div>
                </div>

                {/* Add Button - Bottom Right */}
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onAddClick(node.id, node.name)
                    }}
                    className="absolute bottom-1 right-1 p-1 hover:bg-muted rounded-full text-muted-foreground hover:text-primary transition-colors"
                >
                    <Plus className="h-4 w-4" />
                </button>
            </div>

            {/* Children Container */}
            {hasChildren && (
                <div className="relative flex pt-8 gap-8">
                    {/* Horizontal connector line logic is tricky without explicit measurements. 
                        We use a simplified approach:
                        A line above all children, connected to the parent's line.
                     */}

                    {/* Top connector for group of children */}
                    <div className="absolute top-0 left-0 w-full h-8 flex justify-center">
                        {/* Vertical stem from parent */}
                        <div className="h-full w-px bg-border" />
                    </div>

                    {/* Horizontal bar connecting first to last child usually needed here, 
                         but flex-gap handles spacing. We need distinct lines for each child.
                         
                         Instead of one parent connector, each child renders its own "up" connector 
                         that joins a horizontal bar.
                     */}
                </div>
            )}

            {/* 
                Recursive Children Rendering 
                We render children in a horizontal row 
            */}
            {hasChildren && (
                <div className="flex items-start gap-4 mt-0 relative">
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

                            {node.children!.length > 1 && (
                                <div className={cn(
                                    "absolute top-[-2rem] h-px bg-border",
                                    index === 0 ? "left-1/2 w-1/2" :
                                        index === node.children!.length - 1 ? "right-1/2 w-1/2" : "w-full"
                                )} />
                            )}

                            {/* Vertical connection to child */}
                            <div className="h-8 w-px bg-border" />

                            <RecursiveNode
                                node={child}
                                allUsers={allUsers}
                                onAddClick={onAddClick}
                                depth={depth + 1}
                                isLast={index === node.children!.length - 1}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
