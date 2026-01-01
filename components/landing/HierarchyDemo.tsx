"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import Image from "next/image"

interface HierarchyNode {
  name: string
  title: string
  role: "CEO" | "EXECUTIVE" | "MANAGER" | "EMPLOYEE"
  children?: HierarchyNode[]
}

// CEO node (Desktop version - wide layout)
const ceoNode: HierarchyNode = {
  name: "Michael Anderson",
  title: "Founder And CEO",
  role: "CEO",
  children: [
    {
      name: "James Wilson",
      title: "CTO",
      role: "EXECUTIVE",
      children: [
        {
          name: "Robert Thompson",
          title: "Engineering Manager",
          role: "MANAGER",
          children: [
            {
              name: "Andrew Parker",
              title: "Backend Developer",
              role: "EMPLOYEE"
            },
            {
              name: "Lucas Martinez",
              title: "Frontend Developer",
              role: "EMPLOYEE"
            }
          ]
        },
        {
          name: "Emily Johnson",
          title: "QA Engineer",
          role: "EMPLOYEE"
        }
      ]
    },
    {
      name: "Maya Goldstein",
      title: "CMO",
      role: "EXECUTIVE",
      children: [
        {
          name: "Jessica Brown",
          title: "Content Manager",
          role: "EMPLOYEE"
        },
        {
          name: "Olivia Harris",
          title: "Social Media Manager",
          role: "EMPLOYEE"
        }
      ]
    }
  ]
}

// Mobile version - tree structure
// Founder -> 2 managers -> 1 manager has 2 workers, 1 manager has 1 worker
const mobileCeoNode: HierarchyNode = {
  name: "Michael Anderson",
  title: "Founder And CEO",
  role: "CEO",
  children: [
    {
      name: "Robert Thompson",
      title: "Engineering Manager",
      role: "MANAGER",
      children: [
        {
          name: "Andrew Parker",
          title: "Backend Developer",
          role: "EMPLOYEE"
        },
        {
          name: "Lucas Martinez",
          title: "Frontend Developer",
          role: "EMPLOYEE"
        }
      ]
    },
    {
      name: "James Wilson",
      title: "Product Manager",
      role: "MANAGER",
      children: [
        {
          name: "Emily Johnson",
          title: "QA Engineer",
          role: "EMPLOYEE"
        }
      ]
    }
  ]
}

function HierarchyNodeCard({ node, isRoot = false }: { node: HierarchyNode; isRoot?: boolean }) {

  const getBarColor = () => {
    if (isRoot) return "bg-primary"
    if (node.role === "CEO") return "bg-black dark:bg-white"
    if (node.role === "EXECUTIVE" || node.role === "MANAGER") return "bg-amber-700"
    return "bg-green-500"
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  if (isRoot) {
    return (
      <div className="bg-primary text-primary-foreground px-4 md:px-6 lg:px-8 py-1.5 md:py-2 rounded-lg shadow-lg border-2 border-primary-foreground/20 z-10 flex flex-row items-center justify-center relative">
        <div className="absolute left-2 h-5 w-5 md:h-6 md:w-6 bg-white/95 rounded-md flex items-center justify-center border-2 border-dashed border-primary/20 overflow-hidden shadow-sm">
          <Image
            src="/collabologocut.png"
            alt="Collabo Logo"
            width={24}
            height={24}
            className="h-full w-full object-contain"
          />
        </div>
        <span className="font-bold text-xs md:text-sm lg:text-base ml-4 md:ml-5">{node.name}</span>
      </div>
    )
  }

  return (
    <div className="relative group flex flex-col items-start p-0.5 md:p-1 rounded border bg-card text-card-foreground shadow-sm w-[75px] md:w-[90px] lg:w-[105px] hover:shadow-md transition-all">
      <div className={cn("absolute top-0 left-0 w-0.5 h-full rounded-l", getBarColor())} />
      <div className="pl-1 md:pl-1.5 flex items-center gap-0.5 md:gap-1 w-full">
        <Avatar className="h-4 w-4 md:h-5 md:w-5 border border-border/50 shrink-0">
          <AvatarFallback className="bg-muted text-muted-foreground text-[6px] md:text-[7px]">
            {getInitials(node.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col overflow-hidden min-w-0">
          <div className="font-semibold truncate text-[8px] md:text-[9px] leading-tight" title={node.name}>
            {node.name}
          </div>
          <div className="text-[6px] md:text-[7px] text-muted-foreground capitalize leading-tight truncate">
            {node.title}
          </div>
        </div>
      </div>
    </div>
  )
}

// Desktop version - horizontal layout
function HierarchyLevel({ nodes, depth = 0 }: { nodes: HierarchyNode[]; depth?: number }) {
  if (!nodes || nodes.length === 0) return null

  return (
    <div className="flex flex-col items-center w-full">
      {/* Horizontal row of nodes at this level */}
      <div className="flex justify-center items-start gap-1 md:gap-1.5 lg:gap-2 relative">
        {nodes.map((node, index) => {
          const hasChildren = node.children && node.children.length > 0
          const isFirst = index === 0
          const isLast = index === nodes.length - 1
          const isOnly = nodes.length === 1

          return (
            <div key={index} className="flex flex-col items-center relative">
              {/* Horizontal connector lines between siblings */}
              {!isOnly && (
                <>
                  {/* Line extending to the right (for first and middle nodes) */}
                  {!isLast && (
                    <div className="absolute -top-2.5 left-1/2 h-px bg-border w-[calc(50%+0.5rem)] md:w-[calc(50%+0.75rem)] lg:w-[calc(50%+1rem)]" />
                  )}
                  {/* Line extending to the left (for last and middle nodes) */}
                  {!isFirst && (
                    <div className="absolute -top-2.5 right-1/2 h-px bg-border w-[calc(50%+0.5rem)] md:w-[calc(50%+0.75rem)] lg:w-[calc(50%+1rem)]" />
                  )}
                </>
              )}

              {/* Vertical line from parent to this node */}
              {depth >= 0 && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-2.5 w-px bg-border" />
              )}

              {/* Node Card */}
              <HierarchyNodeCard node={node} />

              {/* Vertical connector line from node to children */}
              {hasChildren && (
                <div className="h-1.5 md:h-2 w-px bg-border my-0.5 md:my-1" />
              )}

              {/* Recursive children rendered horizontally */}
              {hasChildren && (
                <HierarchyLevel nodes={node.children!} depth={depth + 1} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Mobile version - tree layout with horizontal branches
function MobileHierarchyLevel({ nodes, depth = 0 }: { nodes: HierarchyNode[]; depth?: number }) {
  if (!nodes || nodes.length === 0) return null

  return (
    <div className="flex flex-col items-center w-full">
      {/* Horizontal row of nodes at this level */}
      <div className="flex justify-center items-start gap-1 relative">
        {nodes.map((node, index) => {
          const hasChildren = node.children && node.children.length > 0
          const isFirst = index === 0
          const isLast = index === nodes.length - 1
          const isOnly = nodes.length === 1

          return (
            <div key={index} className="flex flex-col items-center relative">
              {/* Horizontal connector lines between siblings */}
              {!isOnly && (
                <>
                  {/* Line extending to the right (for first and middle nodes) */}
                  {!isLast && (
                    <div className="absolute -top-2.5 left-1/2 h-px bg-border w-[calc(50%+0.5rem)]" />
                  )}
                  {/* Line extending to the left (for last and middle nodes) */}
                  {!isFirst && (
                    <div className="absolute -top-2.5 right-1/2 h-px bg-border w-[calc(50%+0.5rem)]" />
                  )}
                </>
              )}

              {/* Vertical line from parent to this node */}
              {depth >= 0 && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-2.5 w-px bg-border" />
              )}

              {/* Node Card */}
              <HierarchyNodeCard node={node} />

              {/* Vertical connector line from node to children */}
              {hasChildren && (
                <div className="h-1.5 w-px bg-border my-0.5" />
              )}

              {/* Recursive children rendered horizontally */}
              {hasChildren && (
                <MobileHierarchyLevel nodes={node.children!} depth={depth + 1} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function HierarchyDemo() {
  return (
    <div className="w-full flex justify-center items-center overflow-hidden">
      {/* Mobile Version - Tree Layout */}
      <div className="flex flex-col items-center relative mx-auto md:hidden">
        {/* Company Header */}
        <div className="mb-1">
          <HierarchyNodeCard
            node={{ name: "Collabo", title: "Organization", role: "CEO" }}
            isRoot
          />
        </div>

        {/* Vertical connector from company to CEO */}
        <div className="h-2 w-px bg-border mb-1" />

        {/* CEO Node */}
        <div className="mb-1">
          <HierarchyNodeCard node={mobileCeoNode} />
        </div>

        {/* Vertical connector from CEO to team */}
        {mobileCeoNode.children && mobileCeoNode.children.length > 0 && (
          <div className="h-1.5 w-px bg-border mb-1" />
        )}

        {/* Hierarchy Tree - Tree Structure */}
        <div className="relative w-full">
          <MobileHierarchyLevel nodes={mobileCeoNode.children || []} />
        </div>
      </div>

      {/* Desktop Version - Horizontal Layout */}
      <div className="hidden md:flex flex-col items-center relative mx-auto">
        {/* Company Header */}
        <div className="mb-1 md:mb-1.5">
          <HierarchyNodeCard
            node={{ name: "Collabo", title: "Organization", role: "CEO" }}
            isRoot
          />
        </div>

        {/* Vertical connector from company to CEO */}
        <div className="h-2 md:h-2.5 w-px bg-border mb-1 md:mb-1.5" />

        {/* CEO Node */}
        <div className="mb-1 md:mb-1.5">
          <HierarchyNodeCard node={ceoNode} />
        </div>

        {/* Vertical connector from CEO to executives */}
        {ceoNode.children && ceoNode.children.length > 0 && (
          <div className="h-1.5 md:h-2 w-px bg-border mb-1 md:mb-1.5" />
        )}

        {/* Hierarchy Tree - Executives and below */}
        <div className="relative w-full">
          <HierarchyLevel nodes={ceoNode.children || []} />
        </div>
      </div>
    </div>
  )
}

