"use client"

import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle, Building2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useProject } from "@/components/providers/ProjectProvider"

export function ProjectSwitcher({ className }: { className?: string }) {
    const { projects, activeProject, switchProject, createProject, joinProject, respondToInvitation, isLoading } = useProject()

    // Switcher State
    const [open, setOpen] = React.useState(false)

    // Dialog States
    const [showCreateDialog, setShowCreateDialog] = React.useState(false)
    const [showJoinDialog, setShowJoinDialog] = React.useState(false)
    const [invitationDialog, setInvitationDialog] = React.useState<{ open: boolean; projectId: string; projectName: string }>({
        open: false,
        projectId: "",
        projectName: ""
    })

    // Form States
    const [projectName, setProjectName] = React.useState("")
    const [joinCode, setJoinCode] = React.useState("")
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    const handleAcceptInvitation = async () => {
        setIsSubmitting(true)
        try {
            await respondToInvitation(invitationDialog.projectId, 'ACCEPT')
            setInvitationDialog(prev => ({ ...prev, open: false }))
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleRejectInvitation = async () => {
        setIsSubmitting(true)
        try {
            await respondToInvitation(invitationDialog.projectId, 'REJECT')
            setInvitationDialog(prev => ({ ...prev, open: false }))
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCreateProject = async () => {
        if (!projectName.trim()) return
        setIsSubmitting(true)
        try {
            await createProject(projectName)
            setShowCreateDialog(false)
            setProjectName("")
        } catch {
            // Error handled in provider
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleJoinProject = async () => {
        if (!joinCode.trim()) return
        setIsSubmitting(true)
        try {
            await joinProject(joinCode)
            setShowJoinDialog(false)
            setJoinCode("")
        } catch {
            // Error handled in provider
        } finally {
            setIsSubmitting(false)
        }
    }

    // Helper to render the command items consistently
    const renderCommandItems = () => (
        <>
            <CommandItem
                onSelect={() => {
                    setOpen(false)
                    setShowCreateDialog(true)
                }}
                className="cursor-pointer"
            >
                <PlusCircle className="mr-2 h-5 w-5" />
                Create Team
            </CommandItem>
            <CommandItem
                onSelect={() => {
                    setOpen(false)
                    setShowJoinDialog(true)
                }}
                className="cursor-pointer"
            >
                <Building2 className="mr-2 h-5 w-5" />
                Join Team
            </CommandItem>
        </>
    )

    // Handle "No Project" state
    if (!activeProject && !isLoading) {
        return (
            <>
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className={cn("w-full justify-between h-12 px-3 border-dashed", className)}
                        >
                            <div className="flex items-center gap-2 text-muted-foreground truncate flex-1">
                                <PlusCircle className="h-5 w-5 shrink-0" />
                                <span className="text-sm font-medium truncate">Select Workspace</span>
                            </div>
                            <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0" align="start">
                        <Command>
                            <CommandList>
                                <CommandGroup>
                                    {renderCommandItems()}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>

                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create Team</DialogTitle>
                            <DialogDescription>
                                Add a new workspace to manage projects and tasks.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2 pb-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Team Name</Label>
                                <Input
                                    id="name"
                                    placeholder="Acme Inc."
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                            <Button onClick={handleCreateProject} disabled={isSubmitting}>
                                {isSubmitting ? "Creating..." : "Create Team"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Join Team</DialogTitle>
                            <DialogDescription>
                                Enter the invite code shared by your team administrator.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2 pb-4">
                            <div className="space-y-2">
                                <Label htmlFor="code">Invite Code</Label>
                                <Input
                                    id="code"
                                    placeholder="Enter code"
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowJoinDialog(false)}>Cancel</Button>
                            <Button onClick={handleJoinProject} disabled={isSubmitting}>
                                {isSubmitting ? "Sending Request..." : "Join Team"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </>
        )
    }

    if (isLoading) {
        return <div className="h-12 w-full bg-muted animate-pulse rounded-md" />
    }

    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        aria-label="Select a team"
                        className={cn("w-full justify-between h-12 px-3", className)}
                    >
                        <div className="flex items-center gap-2 text-left truncate">
                            <Avatar className="h-6 w-6">
                                {activeProject?.logo && (
                                    <AvatarImage
                                        src={activeProject.logo}
                                        alt={activeProject.name}
                                        className="object-cover contrast-[1.1] saturate-[1.1]"
                                    />
                                )}
                                <AvatarFallback className="text-[10px]">{activeProject?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col gap-0.5 truncate">
                                <span className="truncate text-sm font-medium leading-none">{activeProject?.name}</span>
                                <span className="truncate text-xs text-muted-foreground">{activeProject?.plan || "Free"}</span>
                            </div>
                        </div>
                        <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                    <Command>
                        <CommandList>
                            <CommandInput placeholder="Search team..." />
                            <CommandEmpty>No team found.</CommandEmpty>
                            <CommandGroup heading="Teams">
                                {projects.map((project) => (
                                    <CommandItem
                                        key={project.id}
                                        onSelect={() => {
                                            if (project.status === "INVITED") {
                                                setInvitationDialog({
                                                    open: true,
                                                    projectId: project.id,
                                                    projectName: project.name
                                                })
                                                setOpen(false)
                                            } else if (project.id !== activeProject?.id) {
                                                switchProject(project.id)
                                                setOpen(false)
                                            }
                                        }}
                                        className="text-sm"
                                    >
                                        <Avatar className="mr-2 h-5 w-5 transition-all">
                                            {project.logo && (
                                                <AvatarImage
                                                    src={project.logo}
                                                    alt={project.name}
                                                    className={cn(
                                                        "object-cover transition-all duration-300",
                                                        activeProject?.id === project.id
                                                            ? "grayscale-0 !grayscale-0 contrast-125 saturate-150 brightness-110"
                                                            : "grayscale opacity-40 brightness-90"
                                                    )}
                                                />
                                            )}
                                            <AvatarFallback className="text-[10px]">{project.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        {project.name}
                                        {project.status === "INVITED" && (
                                            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                Invited
                                            </span>
                                        )}
                                        <Check
                                            className={cn(
                                                "ml-auto h-4 w-4",
                                                activeProject?.id === project.id
                                                    ? "opacity-100"
                                                    : "opacity-0"
                                            )}
                                        />
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                        <CommandSeparator />
                        <CommandList>
                            <CommandGroup>
                                {renderCommandItems()}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Team</DialogTitle>
                        <DialogDescription>
                            Add a new workspace to manage projects and tasks.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2 pb-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Team Name</Label>
                            <Input
                                id="name"
                                placeholder="Acme Inc."
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                        <Button onClick={handleCreateProject} disabled={isSubmitting}>
                            {isSubmitting ? "Creating..." : "Create Team"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Join Team</DialogTitle>
                        <DialogDescription>
                            Enter the invite code shared by your team administrator.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2 pb-4">
                        <div className="space-y-2">
                            <Label htmlFor="code">Invite Code</Label>
                            <Input
                                id="code"
                                placeholder="Enter code"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowJoinDialog(false)}>Cancel</Button>
                        <Button onClick={handleJoinProject} disabled={isSubmitting}>
                            {isSubmitting ? "Sending Request..." : "Join Team"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={invitationDialog.open} onOpenChange={(val) => setInvitationDialog(prev => ({ ...prev, open: val }))}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Team Invitation</DialogTitle>
                        <DialogDescription>
                            You have been invited to join <strong>{invitationDialog.projectName}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={handleRejectInvitation} disabled={isSubmitting}>
                            Decline
                        </Button>
                        <Button onClick={handleAcceptInvitation} disabled={isSubmitting}>
                            {isSubmitting ? "Accepting..." : "Accept Invitation"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
