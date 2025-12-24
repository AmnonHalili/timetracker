"use client"

import { useEffect, useState, useMemo } from "react"
import { RecursiveNode } from "@/components/team/RecursiveNode"
import { AddChildDialog } from "@/components/team/AddChildDialog"
import { User } from "@prisma/client"
import { Loader2, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"

import { AddMemberDialog } from "@/components/team/AddMemberDialog"

// Defined locally to match RecursiveNode props
type TreeNode = User & { children: TreeNode[], managerId: string | null }

export default function HierarchyPage() {
    const { data: session } = useSession()
    const [users, setUsers] = useState<User[]>([])
    const [projectName, setProjectName] = useState("Organization")
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
            if (data.projectName) setProjectName(data.projectName)
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
        users.forEach((user: any) => {
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
                    {session?.user?.role === "ADMIN" && (
                        <AddMemberDialog
                            triggerLabel="Add Admin"
                            defaultRole="ADMIN"
                            lockRole={true}
                            hideManagerSelect={true}
                            onSuccess={fetchHierarchy}
                            customTrigger={
                                <Button variant="outline" size="sm" className="gap-2 bg-background/50 backdrop-blur-sm">
                                    <UserPlus className="h-4 w-4" />
                                    <span className="hidden sm:inline">Add Admin</span>
                                </Button>
                            }
                        />
                    )}
                </div>
            </div>

            {/* Project Root Node Section */}
            <div className="flex flex-col items-center mb-8 relative">
                {/* Project Card */}
                <div className="bg-primary text-primary-foreground px-8 py-4 rounded-xl shadow-lg border-2 border-primary-foreground/20 z-10 mb-8">
                    <h2 className="text-xl font-bold tracking-tight">{projectName}</h2>
                    <div className="text-sm opacity-80 text-center uppercase tracking-wider font-medium">Company Overview</div>
                </div>

                {/* Connector to Roots */}
                {tree && tree.length > 0 && (
                    <>
                        {/* Vertical line from Project Card down */}
                        <div className="absolute top-[3.5rem] h-8 w-px bg-border" />

                        {/* Horizontal Line spanning first to last root */}
                        {tree.length > 1 && (
                            <div className="absolute top-[5.5rem] h-px bg-border w-full max-w-[calc(100%-16rem)] hidden" />
                            // Calculating exact width is tricky. 
                            // Let's use the same trick as RecursiveNode: each child draws its own connector
                        )}

                        <div className="absolute top-[5.5rem] w-full flex justify-center">
                            {/* This is the horizontal bus line from which roots hang */}
                            {/* Ideally, we want a line traversing the tops of the root nodes. 
                                 The root nodes are rendered below in a flex row.
                             */}
                        </div>
                    </>
                )}
            </div>

            <div className="flex justify-center min-w-max pb-20">
                <div className="flex gap-8 relative items-start">
                    {/* Horizontal Line Logic:
                        We construct the horizontal bus line using segments from each child.
                        Gap is 32px (2rem). Half gap is 16px (1rem).
                     */}
                    {tree?.map((rootNode, index) => {
                        const isFirst = index === 0
                        const isLast = index === (tree.length - 1)
                        const isOnly = tree.length === 1

                        return (
                            <div key={rootNode.id} className="relative flex flex-col items-center">
                                {/* Horizontal Segments */}
                                {!isOnly && (
                                    <>
                                        {/* Connector to Right Sibling (for First and Middle) */}
                                        {!isLast && (
                                            <div className="absolute top-[-2rem] right-[-1rem] h-px bg-border w-[calc(50%+1rem)]" />
                                        )}
                                        {/* Connector to Left Sibling (for Last and Middle) */}
                                        {!isFirst && (
                                            <div className="absolute top-[-2rem] left-[-1rem] h-px bg-border w-[calc(50%+1rem)]" />
                                        )}
                                    </>
                                )}

                                {/* Vertical line up to the Project Bus */}
                                <div className="h-8 w-px bg-border absolute -top-8" />

                                <RecursiveNode
                                    node={rootNode}
                                    allUsers={users}
                                    onAddClick={handleAddClick}
                                />
                            </div>
                        )
                    })}
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
