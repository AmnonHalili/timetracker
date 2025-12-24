"use client"

import { useEffect, useState, useMemo } from "react"
import { RecursiveNode } from "@/components/team/RecursiveNode"
import { AddChildDialog } from "@/components/team/AddChildDialog"
import { User } from "@prisma/client"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useSession } from "next-auth/react"

import { AddMemberDialog } from "@/components/team/AddMemberDialog"

// Defined locally to match RecursiveNode props
type TreeNode = User & { children: TreeNode[], managerId: string | null }

export default function HierarchyPage() {
    const [users, setUsers] = useState<User[]>([])
    const [isLoading, setIsLoading] = useState(true)

    // Dialog State
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [targetParentId, setTargetParentId] = useState<string | null>(null)
    const [targetParentName, setTargetParentName] = useState("")

    const fetchHierarchy = async () => {
        setIsLoading(true)
        try {
            const res = await fetch("/api/team/hierarchy")
            if (!res.ok) throw new Error("Failed to fetch hierarchy")
            const data = await res.json()
            setUsers(data.users || [])
        } catch (error) {
            console.error(error)
            toast.error("Failed to load hierarchy")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchHierarchy()
    }, [])

    const handleAddClick = (parentId: string, parentName: string) => {
        setTargetParentId(parentId)
        setTargetParentName(parentName)
        setIsAddDialogOpen(true)
    }

    // Build Tree Structure from Flat List
    const tree = useMemo(() => {
        if (!users.length) return null

        const userMap = new Map<string, TreeNode>()
        const rootNodes: TreeNode[] = []

        // Initialize recursive nodes
        users.forEach(user => {
            userMap.set(user.id, { ...user, children: [] })
        })

        // Build relations
        users.forEach((user: any) => {
            const node = userMap.get(user.id)!
            if (user.managerId && userMap.has(user.managerId)) {
                userMap.get(user.managerId)!.children.push(node)
            } else {
                // If manager is not in the list (filtered out) or doesn't exist, this is a root node for the current view
                rootNodes.push(node)
            }
        })

        // Sort roots: Admin first, then others
        return rootNodes.sort((a, b) => (a.role === 'ADMIN' ? -1 : 1))
    }, [users])

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8" /></div>
    }

    return (
        <div className="p-8 overflow-auto min-h-[calc(100vh-4rem)] bg-background/50">
            <div className="flex justify-between items-center max-w-5xl mx-auto mb-8 relative">
                <h1 className="text-2xl font-bold text-center w-full">Organization Hierarchy</h1>
                <div className="absolute right-0 top-0">
                    <AddMemberDialog
                        triggerLabel="Add Admin"
                        defaultRole="ADMIN"
                        lockRole={true}
                        hideManagerSelect={true}
                        onSuccess={fetchHierarchy}
                    />
                </div>
            </div>

            <div className="flex justify-center min-w-max pb-20">
                <div className="flex gap-8">
                    {tree?.map((rootNode) => (
                        <div key={rootNode.id} className="relative">
                            <RecursiveNode
                                node={rootNode}
                                allUsers={users}
                                onAddClick={handleAddClick}
                            />
                        </div>
                    ))}
                    {!tree?.length && <div className="text-muted-foreground">No users found.</div>}
                </div>
            </div>

            <AddChildDialog
                isOpen={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                parentId={targetParentId}
                parentName={targetParentName}
                availableUsers={users}
                onSuccess={fetchHierarchy}
            />
        </div>
    )
}
