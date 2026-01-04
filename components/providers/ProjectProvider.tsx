
"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type Project = {
    id: string
    name: string
    plan: string
    logo: string | null
    role?: string
}

type ProjectContextType = {
    projects: Project[]
    activeProject: Project | null
    isLoading: boolean
    switchProject: (projectId: string) => Promise<void>
    createProject: (name: string) => Promise<void>
    joinProject: (joinCode: string) => Promise<void>
    refreshProjects: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export function ProjectProvider({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [projects, setProjects] = useState<Project[]>([])
    const [activeProject, setActiveProject] = useState<Project | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const refreshProjects = async () => {
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
                    setActiveProject(current || null)
                } else if (data.length > 0 && !activeProject) {
                    // Fallback: If no active project in session but user has projects (edge case),
                    // we might want to prompt them or just leave it null.
                    // For now, leaving it null to show "No Project" state.
                }
            }
        } catch (error) {
            console.error("Failed to fetch projects", error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        refreshProjects()
    }, [status, session?.user?.projectId])

    const switchProject = async (projectId: string) => {
        const loadingToast = toast.loading("Switching workspace...")
        try {
            const res = await fetch("/api/projects/switch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId }),
            })

            if (!res.ok) throw new Error("Failed to switch project")

            const targetProject = projects.find(p => p.id === projectId)
            setActiveProject(targetProject || null)

            toast.success(`Switched to ${targetProject?.name}`, { id: loadingToast })

            // Refresh the page to reload all server components with new context
            router.refresh()

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
                router.refresh()
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

    return (
        <ProjectContext.Provider value={{
            projects,
            activeProject,
            isLoading,
            switchProject,
            createProject,
            joinProject,
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
