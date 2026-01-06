
"use client"

import React, { createContext, useContext, useEffect, useState, useTransition } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type Project = {
    id: string
    name: string
    plan: string
    logo: string | null
    role?: string
    status?: string
}

type ProjectContextType = {
    projects: Project[]
    activeProject: Project | null
    isLoading: boolean
    isSwitching: boolean
    switchProject: (projectId: string) => Promise<void>
    createProject: (name: string) => Promise<void>
    joinProject: (joinCode: string) => Promise<void>
    respondToInvitation: (projectId: string, action: 'ACCEPT' | 'REJECT') => Promise<void>
    refreshProjects: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export function ProjectProvider({ children }: { children: React.ReactNode }) {
    const { data: session, status, update } = useSession()
    const router = useRouter()
    const [projects, setProjects] = useState<Project[]>([])
    const [activeProject, setActiveProject] = useState<Project | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isPending, startTransition] = useTransition()
    const optimisticProjectId = React.useRef<string | null>(null)

    const refreshProjects = React.useCallback(async () => {
        if (status !== "authenticated") {
            setIsLoading(false)
            return
        }

        try {
            const res = await fetch("/api/projects")
            if (res.ok) {
                const data = await res.json()
                setProjects(data)

                // Sync active project from session
                if (session?.user?.projectId) {
                    const current = data.find((p: Project) => p.id === session.user.projectId)

                    // Only sync if we are not in an optimistic state OR if session has caught up
                    if (!optimisticProjectId.current || optimisticProjectId.current === session.user.projectId) {
                        setActiveProject(prev => {
                            // Only update if it actually changed to prevent unnecessary re-renders
                            if (prev?.id !== current?.id) {
                                return current || null
                            }
                            return prev
                        })
                        if (optimisticProjectId.current === session.user.projectId) {
                            optimisticProjectId.current = null // Reset if matched
                        }
                    }
                } else {
                    // If no project in session, clear active project only if it exists
                    setActiveProject(prev => prev ? null : prev)
                }
            }

        } catch (error) {
            console.error("Failed to fetch projects", error)
        } finally {
            setIsLoading(false)
        }
    }, [status, session?.user?.projectId]) // Removed activeProject from dependencies to prevent infinite loop

    useEffect(() => {
        refreshProjects()
    }, [refreshProjects])

    const switchProject = async (projectId: string) => {
        const loadingToast = toast.loading("Switching workspace...")
        try {
            const res = await fetch("/api/projects/switch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId }),
            })

            if (!res.ok) throw new Error("Failed to switch project")

            const data = await res.json()
            const targetProject = projects.find(p => p.id === projectId)
            setActiveProject(targetProject || null)
            optimisticProjectId.current = projectId // Set optimistic ID

            toast.success(`Switched to ${targetProject?.name}`, { id: loadingToast })

            // Update the session to reflect the change immediately
            await update({ projectId, role: data.role })

            // Refresh the page w/ transition to track loading state
            startTransition(() => {
                router.refresh()
            })

        } catch (error) {
            console.error(error)
            toast.error("Failed to switch workspace", { id: loadingToast })
        }
    }

    const createProject = async (name: string) => {
        const loadingToast = toast.loading("Creating workspace...")
        try {
            const res = await fetch("/api/projects/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to create project")

            toast.success("Workspace created!", { id: loadingToast })
            await refreshProjects()

            // The create API automatically switches schema context, but we need to ensure frontend matches
            // refreshProjects might catch it if session updates fast enough, but let's be sure
            if (data.id) {
                const newProject = { id: data.id, name: data.name, plan: 'FREE', logo: null, role: 'ADMIN' }
                setProjects(prev => [...prev, newProject])
                setActiveProject(newProject)
                optimisticProjectId.current = newProject.id
                await update({ projectId: data.id, role: 'ADMIN' })

                startTransition(() => {
                    router.refresh()
                })
            }

        } catch (error) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : "Failed to create workspace", { id: loadingToast })
            throw error
        }
    }

    const joinProject = async (joinCode: string) => {
        const loadingToast = toast.loading("Sending join request...")
        try {
            const res = await fetch("/api/projects/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ joinCode }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to join project")

            toast.success(data.message || "Request sent!", { id: loadingToast })
            // No need to refresh/switch immediately as it's pending
        } catch (error) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : "Failed to join workspace", { id: loadingToast })
            throw error
        }
    }

    const respondToInvitation = async (projectId: string, action: 'ACCEPT' | 'REJECT') => {
        const loadingToast = toast.loading(`${action === 'ACCEPT' ? 'Accepting' : 'Rejecting'} invitation...`)
        try {
            const res = await fetch("/api/team/invitation/respond", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId, action }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to respond")

            toast.success(data.message || "Updated!", { id: loadingToast })
            await refreshProjects()

            if (action === 'ACCEPT') {
                // Optionally switch to it
                switchProject(projectId)
            }
        } catch (error) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : "Failed to update invitation", { id: loadingToast })
            throw error
        }
    }

    return (
        <ProjectContext.Provider value={{
            projects,
            activeProject,
            isLoading,
            isSwitching: isPending,
            switchProject,
            createProject,
            joinProject,
            respondToInvitation,
            refreshProjects
        }}>
            {children}
        </ProjectContext.Provider>
    )
}

export function useProject() {
    const context = useContext(ProjectContext)
    if (context === undefined) {
        throw new Error("useProject must be used within a ProjectProvider")
    }
    return context
}
