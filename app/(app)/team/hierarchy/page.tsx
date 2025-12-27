"use client"

import { useEffect, useState, useMemo } from "react"
import { RecursiveNode } from "@/components/team/RecursiveNode"
import { AddChildDialog } from "@/components/team/AddChildDialog"
import { User } from "@prisma/client"
import { Loader2, UserPlus, Pencil, ZoomIn, ZoomOut, Network } from "lucide-react"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { ImageCropperDialog } from "@/components/ui/ImageCropperDialog"
import Image from "next/image"

import { AddMemberDialog } from "@/components/team/AddMemberDialog"
import { JoinRequestsWidget } from "@/components/team/JoinRequestsWidget"
import { TeamOnboardingWidget } from "@/components/dashboard/TeamOnboardingWidget"

// Defined locally to match RecursiveNode props
type TreeNode = User & {
    children: TreeNode[],
    managerId: string | null,
    sharedChiefGroupId?: string | null,
    createdAt: Date
}

export default function HierarchyPage() {
    const { data: session } = useSession()
    const [users, setUsers] = useState<User[]>([])
    const [projectName, setProjectName] = useState("Organization")
    const [projectId, setProjectId] = useState<string | null>(null)
    const [projectLogo, setProjectLogo] = useState<string | null>(null) // Displayed logo
    const [isLoading, setIsLoading] = useState(true)
    const [hasProject, setHasProject] = useState(true)

    // Cropper State
    const [tempImageSrc, setTempImageSrc] = useState<string | null>(null)
    const [isCropperOpen, setIsCropperOpen] = useState(false)

    // Dialog State
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [targetParentId, setTargetParentId] = useState<string | null>(null)
    const [targetParentName, setTargetParentName] = useState("")

    // Zoom state
    const [zoomLevel, setZoomLevel] = useState(1)
    const [baseZoom, setBaseZoom] = useState(1) // The zoom level where the entire tree fits (will be calculated as 100%)
    const maxZoom = 2
    const zoomStep = 0.1

    // Pan state for dragging
    const [panPosition, setPanPosition] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [isInitialized, setIsInitialized] = useState(false)

    // Calculate relative zoom percentage (baseZoom = 100%)
    const getRelativeZoomPercent = (zoom: number) => {
        return Math.round((zoom / baseZoom) * 100)
    }

    const fitToScreen = () => {
        // Use requestAnimationFrame to ensure we measure correctly
        requestAnimationFrame(() => {
            const container = document.querySelector('[data-hierarchy-container]') as HTMLElement
            if (container) {
                const parentContainer = container.parentElement
                if (parentContainer) {
                    const parentRect = parentContainer.getBoundingClientRect()
                    const containerRect = container.getBoundingClientRect()

                    // If container has 0 dims, retry later
                    if (containerRect.width === 0 || containerRect.height === 0) return

                    // Get header height
                    const headerElement = parentContainer.querySelector('.p-8') as HTMLElement
                    const headerHeight = headerElement ? headerElement.getBoundingClientRect().height : 200
                    const availableHeight = parentRect.height - headerHeight - 40
                    const availableWidth = parentRect.width - 40

                    // Calculate required zoom based on UNTRANSFORMED dimensions
                    // We use offsetWidth/offsetHeight for unscaled size
                    const widthZoom = availableWidth / container.offsetWidth
                    const heightZoom = availableHeight / container.offsetHeight

                    // Optimal zoom
                    const optimalZoom = Math.max(0.4, Math.min(widthZoom, heightZoom, 1.0))

                    setBaseZoom(optimalZoom)
                    setZoomLevel(optimalZoom)

                    // Robust Centering (Delta Correction)
                    // Calculate shift needed to move current visual center to target center
                    const currentVisualCenterX = containerRect.left + containerRect.width / 2
                    const targetCenterX = parentRect.left + parentRect.width / 2
                    const deltaX = targetCenterX - currentVisualCenterX

                    // Apply delta to current pan to preserve center
                    const newPanX = panPosition.x + deltaX

                    // Vertical: Reset to top (0) or apply specific offset
                    // Using 0 ensures it starts naturally below the header
                    setPanPosition({ x: newPanX, y: 0 })
                    setIsInitialized(true)
                }
            }
        })
    }

    const handleZoomIn = () => {
        setZoomLevel(prev => Math.min(prev + zoomStep, maxZoom))
    }

    const handleZoomOut = () => {
        setZoomLevel(prev => Math.max(prev - zoomStep, baseZoom)) // Don't zoom out below baseZoom
    }

    const handleZoomReset = () => {
        fitToScreen()
    }

    // Handle mouse wheel for zoom
    const handleWheel = (e: React.WheelEvent) => {
        // Prevent default scrolling
        e.preventDefault()

        // Zoom based on wheel direction
        // deltaY > 0 means scrolling down (zoom out), deltaY < 0 means scrolling up (zoom in)
        const delta = e.deltaY > 0 ? -zoomStep : zoomStep
        setZoomLevel(prev => {
            const newZoom = prev + delta
            // Clamp between baseZoom and maxZoom
            return Math.max(baseZoom, Math.min(newZoom, maxZoom))
        })
    }

    // Handle mouse down for dragging
    const handleMouseDown = (e: React.MouseEvent) => {
        // Only left mouse button
        if (e.button !== 0) return
        // Don't drag if clicking on interactive elements
        const target = e.target as HTMLElement
        if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('[role="button"]') || target.closest('[role="dialog"]')) {
            return
        }
        setIsDragging(true)
        setDragStart({
            x: e.clientX - panPosition.x,
            y: e.clientY - panPosition.y
        })
        e.preventDefault()
        e.stopPropagation()
    }

    // Handle mouse move for dragging
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return
        setPanPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        })
        e.preventDefault()
    }

    // Handle mouse up to stop dragging
    const handleMouseUp = () => {
        setIsDragging(false)
    }

    // Handle mouse leave to stop dragging
    const handleMouseLeave = () => {
        setIsDragging(false)
    }

    const fetchHierarchy = async () => {
        setIsLoading(true)
        try {
            const res = await fetch("/api/team/hierarchy")
            if (!res.ok) throw new Error("Failed to fetch hierarchy")

            const data = await res.json()
            setUsers(data.users || [])
            if (data.projectName) setProjectName(data.projectName)
            if (data.projectLogo) setProjectLogo(data.projectLogo)
            if (data.projectId) setProjectId(data.projectId)

            // Private workspace check
            setHasProject(data.projectName !== "Private Workspace")

        } catch (error) {
            console.error("Failed to fetch hierarchy:", error)
            const errorMessage = error instanceof Error ? error.message : "Unknown error"
            toast.error(`Failed to load hierarchy: ${errorMessage}`)
        } finally {
            setIsLoading(false)
            // Trigger initialization immediately
            setIsInitialized(false)
        }
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!projectId) {
            toast.error("Project ID not found. Please refresh.")
            return
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit for raw file
            toast.error("Image too large. Max 5MB.")
            return
        }

        const reader = new FileReader()
        reader.onloadend = () => {
            setTempImageSrc(reader.result as string)
            setIsCropperOpen(true)
        }
        reader.readAsDataURL(file)

        // Reset input
        e.target.value = ''
    }

    const handleCropSave = async (croppedBase64: string) => {
        setProjectLogo(croppedBase64) // Optimistic update

        try {
            const res = await fetch(`/api/projects/${projectId}`, {
                method: "PATCH",
                body: JSON.stringify({ logo: croppedBase64 }),
                headers: { "Content-Type": "application/json" }
            })
            if (!res.ok) throw new Error("Failed to upload logo")
            toast.success("Logo updated")
        } catch (error) {
            console.error(error)
            toast.error("Failed to update logo")
            fetchHierarchy() // Revert
        }
    }

    useEffect(() => {
        fetchHierarchy()
    }, [])

    // Disable scrolling on the main container for this page
    useEffect(() => {
        const mainElement = document.getElementById('main-content')
        if (mainElement) {
            // Store original styles
            const originalOverflow = mainElement.style.overflow
            const originalOverflowY = mainElement.style.overflowY
            const originalHeight = mainElement.style.height

            // Disable all scrolling
            mainElement.style.overflow = 'hidden'
            mainElement.style.overflowY = 'hidden'
            mainElement.style.height = '100vh'

            return () => {
                // Restore original styles
                mainElement.style.overflow = originalOverflow || ''
                mainElement.style.overflowY = originalOverflowY || ''
                mainElement.style.height = originalHeight || ''
            }
        }
    }, [])

    const handleAddClick = (parentId: string, parentName: string) => {
        setTargetParentId(parentId)
        setTargetParentName(parentName)
        setIsAddDialogOpen(true)
    }

    // Build Tree Structure from Flat List
    const tree = useMemo(() => {
        try {
            if (!users.length) return null

            const userMap = new Map<string, TreeNode>()
            const rootNodes: TreeNode[] = []
            const sharedChiefGroups = new Map<string, TreeNode[]>()

            // Initialize recursive nodes
            users.forEach((user) => {
                // Ensure all required fields exist with defaults
                const userWithExtras = user as User & { sharedChiefGroupId?: string | null; createdAt?: Date | string }
                const node: TreeNode = {
                    ...user,
                    children: [],
                    sharedChiefGroupId: userWithExtras.sharedChiefGroupId || null,
                    createdAt: userWithExtras.createdAt ? new Date(userWithExtras.createdAt) : new Date()
                }
                userMap.set(user.id, node)
            })

            // Build relations
            users.forEach((user) => {
                const node = userMap.get(user.id)!
                if (user.managerId && userMap.has(user.managerId)) {
                    userMap.get(user.managerId)!.children.push(node)
                } else {
                    // If manager is not in the list (filtered out) or doesn't exist, this is a root node for the current view
                    // Group shared chiefs together
                    const userWithExtras = user as User & { sharedChiefGroupId?: string | null }
                    const sharedGroupId = userWithExtras.sharedChiefGroupId
                    if (sharedGroupId && user.role === 'ADMIN') {
                        if (!sharedChiefGroups.has(sharedGroupId)) {
                            sharedChiefGroups.set(sharedGroupId, [])
                        }
                        sharedChiefGroups.get(sharedGroupId)!.push(node)
                    } else {
                        rootNodes.push(node)
                    }
                }
            })

            // Add shared chief groups as single nodes (we'll render them specially)
            // For now, we'll add the first chief from each group as the representative
            // and mark it as having shared partners
            sharedChiefGroups.forEach((groupNodes) => {
                // Sort group nodes by creation date (oldest first)
                groupNodes.sort((a, b) =>
                    a.createdAt.getTime() - b.createdAt.getTime()
                )
                // Add all nodes from the group to rootNodes
                rootNodes.push(...groupNodes)
            })

            // Sort roots: Shared chiefs first (grouped), then independent admins, then others
            return rootNodes.sort((a, b) => {
                // Shared chiefs first
                if (a.sharedChiefGroupId && !b.sharedChiefGroupId) return -1
                if (!a.sharedChiefGroupId && b.sharedChiefGroupId) return 1
                // Within shared chiefs, group by sharedChiefGroupId
                if (a.sharedChiefGroupId && b.sharedChiefGroupId) {
                    if (a.sharedChiefGroupId !== b.sharedChiefGroupId) {
                        return a.sharedChiefGroupId.localeCompare(b.sharedChiefGroupId)
                    }
                }
                // Admin before others
                if (a.role === 'ADMIN' && b.role !== 'ADMIN') return -1
                if (a.role !== 'ADMIN' && b.role === 'ADMIN') return 1
                return 0
            })
        } catch (error) {
            console.error("Error building tree:", error)
            // Return empty array on error to prevent crash
            return []
        }
    }, [users])

    // Calculate optimal zoom level and center the tree initially
    useEffect(() => {
        if (tree && !isInitialized && !isLoading) {
            // Delay slightly to allow layout to settle (images etc might take a frame)
            // Double RAF
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    fitToScreen()
                })
            })
        }
    }, [tree, isInitialized, isLoading])



    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8" /></div>
    }

    return (
        <div
            className="w-full bg-background/50 relative"
            style={{
                overflow: 'hidden',
                width: '100%',
                height: 'calc(100vh - 4rem)',
                maxHeight: 'calc(100vh - 4rem)',
                position: 'relative',
                clipPath: 'inset(0)'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
        >
            {/* Header and Controls - Fixed at top */}
            <div className="p-8 pb-4 relative z-20 bg-background/95 backdrop-blur-sm border-b">
                <div className="flex justify-between items-center max-w-5xl mx-auto mb-8 relative">
                    <h1 className="text-2xl font-bold text-center w-full">Organization Hierarchy</h1>
                    {/* Zoom Controls - Left Side */}
                    <div className="absolute left-0 top-0 flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleZoomReset}
                            className="bg-background/50 backdrop-blur-sm gap-2 h-8"
                        >
                            <Network className="h-4 w-4" />
                            <span className="hidden sm:inline">מבט על</span>
                        </Button>
                        <div className="flex items-center gap-1 bg-background/50 backdrop-blur-sm border rounded-md p-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleZoomOut}
                                disabled={zoomLevel <= baseZoom}
                                className="h-8 w-8"
                                aria-label="Zoom out"
                            >
                                <ZoomOut className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleZoomReset}
                                className="h-8 px-2 text-xs font-mono"
                                aria-label={`Reset zoom (current: ${getRelativeZoomPercent(zoomLevel)}%)`}
                            >
                                {getRelativeZoomPercent(zoomLevel)}%
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleZoomIn}
                                disabled={zoomLevel >= maxZoom}
                                className="h-8 w-8"
                                aria-label="Zoom in"
                            >
                                <ZoomIn className="h-4 w-4" aria-hidden="true" />
                            </Button>
                        </div>
                    </div>
                    {/* Add Admin Button - Right Side (Only for actual Admins with Project) */}
                    {hasProject && session?.user?.role === "ADMIN" && (
                        <div className="absolute right-0 top-0">
                            <AddMemberDialog
                                triggerLabel="Add Chief"
                                defaultRole="ADMIN"
                                lockRole={true}
                                hideManagerSelect={true}
                                onSuccess={fetchHierarchy}
                                customTrigger={
                                    <Button variant="outline" size="sm" className="gap-2 bg-background/50 backdrop-blur-sm">
                                        <UserPlus className="h-4 w-4" />
                                        <span className="hidden sm:inline">Add Chief</span>
                                    </Button>
                                }
                            />
                        </div>
                    )}
                </div>

                {session?.user?.role === "ADMIN" && hasProject && (
                    <div className="max-w-2xl mx-auto mb-4">
                        <JoinRequestsWidget />
                    </div>
                )}

                {/* Show Onboarding Widget for Private Workspace */}
                {!hasProject && (
                    <div className="max-w-2xl mx-auto mb-4">
                        <TeamOnboardingWidget />
                    </div>
                )}
            </div>

            {/* Zoom Container - wraps both project card and tree */}
            <div
                data-hierarchy-container
                className="flex flex-col items-center pb-20"
                style={{
                    marginTop: '1rem',
                    width: 'fit-content',
                    minWidth: '100%',
                    transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`,
                    transformOrigin: 'top center',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    opacity: isInitialized ? 1 : 0,
                    transition: 'opacity 0.3s ease-in-out'
                }}
            >
                {/* Project Root Node Section */}
                <div className="flex flex-col items-center mb-8 relative">
                    {/* Project Card */}
                    <div className="bg-primary text-primary-foreground px-16 py-4 rounded-xl shadow-lg border-2 border-primary-foreground/20 z-10 mb-8 flex flex-row items-center justify-center relative">
                        {/* Logo Placeholder - Absolute Left */}
                        <div
                            className="absolute left-3 h-10 w-10 bg-white/95 rounded-lg flex items-center justify-center border-2 border-dashed border-primary/20 cursor-pointer hover:bg-white transition-colors overflow-hidden group/logo shadow-sm"
                            onClick={() => hasProject && session?.user?.role === "ADMIN" && document.getElementById('logo-upload')?.click()}
                        >
                            {projectLogo ? (
                                <>
                                    <Image
                                        src={projectLogo}
                                        alt="Logo"
                                        fill
                                        className="object-contain p-1"
                                        unoptimized // Allow external/data URLs without config
                                    />
                                    {/* Overlay for Edit */}
                                    {hasProject && session?.user?.role === "ADMIN" && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity">
                                            <Pencil className="h-4 w-4 text-white" />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-primary/40"
                                >
                                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                                    <circle cx="9" cy="9" r="2" />
                                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                                </svg>
                            )}
                            <input
                                type="file"
                                id="logo-upload"
                                className="hidden"
                                accept="image/*"
                                onChange={handleLogoUpload}
                            />
                        </div>

                        <h2 className="text-xl font-bold tracking-tight text-center">{projectName}</h2>
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

                {/* Tree Container */}
                <div className="flex justify-center">
                    <div className="flex gap-8 relative items-start">
                        {/* Group shared chiefs and render them together */}
                        {(() => {
                            // Group root nodes by sharedChiefGroupId
                            const grouped: Array<{ type: 'shared' | 'independent', nodes: TreeNode[], groupId?: string }> = []
                            const processed = new Set<string>()

                            tree?.forEach((node) => {
                                if (processed.has(node.id)) return

                                if (node.sharedChiefGroupId && node.role === 'ADMIN') {
                                    // Find all nodes in the same shared group
                                    const sharedGroup = tree.filter(n =>
                                        n.sharedChiefGroupId === node.sharedChiefGroupId &&
                                        n.role === 'ADMIN' &&
                                        !n.managerId
                                    )
                                    sharedGroup.forEach(n => processed.add(n.id))
                                    grouped.push({ type: 'shared', nodes: sharedGroup, groupId: node.sharedChiefGroupId })
                                } else {
                                    processed.add(node.id)
                                    grouped.push({ type: 'independent', nodes: [node] })
                                }
                            })

                            return grouped.map((group, groupIndex) => {
                                if (group.type === 'shared' && group.nodes.length > 1) {
                                    // Merge all children from all partners in the group
                                    const mergedChildren: TreeNode[] = []
                                    const childrenSet = new Set<string>()

                                    group.nodes.forEach(partner => {
                                        partner.children.forEach(child => {
                                            if (!childrenSet.has(child.id)) {
                                                childrenSet.add(child.id)
                                                mergedChildren.push(child)
                                            }
                                        })
                                    })

                                    // Render shared chiefs connected by a horizontal line
                                    return (
                                        <div key={group.groupId} className="relative flex flex-col items-center">
                                            {/* Shared Chiefs - horizontal layout */}
                                            <div className="flex gap-8 items-center relative">
                                                {group.nodes.map((node, nodeIndex) => {
                                                    // Create a version of the node without children (they'll be rendered separately below)
                                                    const nodeWithoutChildren = { ...node, children: [] }

                                                    return (
                                                        <div key={node.id} className="relative flex flex-col items-center">
                                                            <RecursiveNode
                                                                node={nodeWithoutChildren}
                                                                allUsers={users}
                                                                onAddClick={handleAddClick}
                                                                depth={0}
                                                            />

                                                            {/* Horizontal connecting line between partners (except for the last one) */}
                                                            {nodeIndex < group.nodes.length - 1 && (
                                                                <div
                                                                    className="absolute top-1/2 -translate-y-1/2 left-full h-px bg-border z-0"
                                                                    style={{ width: '2rem' }}
                                                                />
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                            {/* Vertical line up to the Project Bus (from center of group) */}
                                            <div className="h-8 w-px bg-border absolute -top-8 left-1/2 -translate-x-1/2" />

                                            {/* Horizontal connector to siblings */}
                                            {groupIndex < grouped.length - 1 && (
                                                <div className="absolute top-[-2rem] right-[-1rem] h-px bg-border w-[calc(50%+1rem)]" />
                                            )}
                                            {groupIndex > 0 && (
                                                <div className="absolute top-[-2rem] left-[-1rem] h-px bg-border w-[calc(50%+1rem)]" />
                                            )}

                                            {/* Render merged children below the partner group */}
                                            {mergedChildren.length > 0 && (
                                                <div className="relative flex flex-col items-center mt-16">
                                                    {/* Vertical connector from partners to children horizontal bus - shortened to stop at bus line */}
                                                    <div className="absolute -top-16 h-8 w-px bg-border" />

                                                    {/* Children in a horizontal row */}
                                                    <div className="flex gap-8 relative items-start">
                                                        {mergedChildren.map((child, childIndex) => {
                                                            const isFirst = childIndex === 0
                                                            const isLast = childIndex === mergedChildren.length - 1
                                                            const isOnly = mergedChildren.length === 1

                                                            return (
                                                                <div key={child.id} className="relative flex flex-col items-center">
                                                                    {/* Horizontal connector segments (bus line) */}
                                                                    {!isOnly && (
                                                                        <>
                                                                            {/* Right segment - extends to right edge of this card */}
                                                                            {!isLast && (
                                                                                <div
                                                                                    className="absolute -top-8 right-[-1rem] h-px bg-border"
                                                                                    style={{ width: 'calc(50% + 1rem)' }}
                                                                                />
                                                                            )}
                                                                            {/* Left segment - extends from left edge of this card */}
                                                                            {!isFirst && (
                                                                                <div
                                                                                    className="absolute -top-8 left-[-1rem] h-px bg-border"
                                                                                    style={{ width: 'calc(50% + 1rem)' }}
                                                                                />
                                                                            )}
                                                                        </>
                                                                    )}

                                                                    {/* Vertical drop line from bus to child card */}
                                                                    <div className="h-8 w-px bg-border absolute -top-8" />

                                                                    <RecursiveNode
                                                                        node={child}
                                                                        allUsers={users}
                                                                        onAddClick={handleAddClick}
                                                                        depth={1}
                                                                        hideConnectorLines={true}
                                                                    />
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                } else {
                                    // Render independent nodes normally
                                    return group.nodes.map((rootNode, nodeIndex) => {
                                        const isFirst = groupIndex === 0 && nodeIndex === 0
                                        const isLast = groupIndex === grouped.length - 1 && nodeIndex === group.nodes.length - 1
                                        const isOnly = grouped.length === 1 && group.nodes.length === 1

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
                                                    depth={0}
                                                />
                                            </div>
                                        )
                                    })
                                }
                            })
                        })()}
                        {!tree?.length && <div className="text-muted-foreground">No users found.</div>}
                    </div>
                </div>
            </div>

            <ImageCropperDialog
                open={isCropperOpen}
                imageSrc={tempImageSrc}
                onClose={() => setIsCropperOpen(false)}
                onCropComplete={handleCropSave}
            />

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
