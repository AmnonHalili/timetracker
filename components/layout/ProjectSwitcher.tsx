
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle, Building2 } from "lucide-react"
import { useRouter } from "next/navigation"

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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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

type Team = {
    label: string
    value: string
    plan: string
    initials: string
    image: string | null
}

interface ProjectSwitcherProps {
    projects: Team[]
    currentProjectId?: string | null
    className?: string
}

export function ProjectSwitcher({ projects, currentProjectId, className }: ProjectSwitcherProps) {
    const [open, setOpen] = React.useState(false)
    const [showNewTeamDialog, setShowNewTeamDialog] = React.useState(false)
    const [showJoinTeamDialog, setShowJoinTeamDialog] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(false)
    const [teamName, setTeamName] = React.useState("")
    const [joinCode, setJoinCode] = React.useState("")

    // Find current team or default to first
    const activeTeam = projects.find(p => p.value === currentProjectId) || projects[0]
    const [selectedTeam, setSelectedTeam] = React.useState<Team | undefined>(activeTeam)

    // Update local state when props change
    React.useEffect(() => {
        if (activeTeam) {
            setSelectedTeam(activeTeam)
        }
    }, [activeTeam, currentProjectId])

    const handleSwitch = async (team: Team) => {
        setSelectedTeam(team) // Optimistic update
        setOpen(false)

        try {
            const res = await fetch('/api/user/switch-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: team.value })
            })

            if (res.ok) {
                window.location.reload()
            }
        } catch (e) {
            console.error("Error switching:", e)
        }
    }

    const handleCreateTeam = async () => {
        if (!teamName) return
        setIsLoading(true)
        try {
            const res = await fetch('/api/projects/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: teamName })
            })

            if (res.ok) {
                setShowNewTeamDialog(false)
                setTeamName("")
                window.location.reload()
            } else {
                console.error("Failed to create team")
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleJoinTeam = async () => {
        if (!joinCode) return
        setIsLoading(true)
        try {
            const res = await fetch('/api/projects/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ joinCode })
            })

            const data = await res.json()
            if (res.ok) {
                setShowJoinTeamDialog(false)
                setJoinCode("")
                window.location.reload()
            } else {
                alert(data.error || "Failed to join team")
            }
        } catch (error) {
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <>
            <Dialog open={showNewTeamDialog} onOpenChange={setShowNewTeamDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Team</DialogTitle>
                        <DialogDescription>
                            Add a new team to manage projects and members.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2 pb-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Team Name</Label>
                            <Input
                                id="name"
                                placeholder="Acme Inc."
                                value={teamName}
                                onChange={(e) => setTeamName(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewTeamDialog(false)}>Cancel</Button>
                        <Button onClick={handleCreateTeam} disabled={isLoading}>
                            {isLoading ? "Creating..." : "Create Team"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showJoinTeamDialog} onOpenChange={setShowJoinTeamDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Join Team</DialogTitle>
                        <DialogDescription>
                            Enter the invite code to join an existing team.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2 pb-4">
                        <div className="space-y-2">
                            <Label htmlFor="join-code">Join Code</Label>
                            <Input
                                id="join-code"
                                placeholder="e.g. A1B2C3"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowJoinTeamDialog(false)}>Cancel</Button>
                        <Button onClick={handleJoinTeam} disabled={isLoading}>
                            {isLoading ? "Joining..." : "Join Team"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        aria-label="Select a team"
                        className={cn("w-full justify-between h-12 px-3 border-dashed", className)}
                    >
                        {selectedTeam ? (
                            <div className="flex items-center gap-2 text-left truncate">
                                <Avatar className="h-6 w-6">
                                    {selectedTeam.image && (
                                        <AvatarImage
                                            src={selectedTeam.image}
                                            alt={selectedTeam.label}
                                            className="object-cover"
                                        />
                                    )}
                                    <AvatarFallback className="text-[10px]">{selectedTeam.initials}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col gap-0.5 truncate">
                                    <span className="truncate text-sm font-medium leading-none">{selectedTeam.label}</span>
                                    <span className="truncate text-xs text-muted-foreground">{selectedTeam.plan}</span>
                                </div>
                            </div>
                        ) : (
                            <span className="text-muted-foreground text-sm">Select Team...</span>
                        )}
                        <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                    <Command>
                        <CommandList>
                            <CommandInput placeholder="Search team..." />
                            <CommandEmpty>No team found.</CommandEmpty>
                            <CommandGroup heading="Teams">
                                {projects.map((team) => (
                                    <CommandItem
                                        key={team.value}
                                        onSelect={() => handleSwitch(team)}
                                        className="text-sm"
                                    >
                                        <Avatar className="mr-2 h-5 w-5">
                                            {team.image && (
                                                <AvatarImage
                                                    src={team.image}
                                                    alt={team.label}
                                                    className="grayscale"
                                                />
                                            )}
                                            <AvatarFallback className="text-[10px]">{team.initials}</AvatarFallback>
                                        </Avatar>
                                        {team.label}
                                        <Check
                                            className={cn(
                                                "ml-auto h-4 w-4",
                                                selectedTeam?.value === team.value
                                                    ? "opacity-100"
                                                    : "opacity-0"
                                            )}
                                        />
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                            <CommandSeparator />
                            <CommandGroup>
                                <CommandItem onSelect={() => {
                                    setOpen(false)
                                    setShowNewTeamDialog(true)
                                }}>
                                    <PlusCircle className="mr-2 h-5 w-5" />
                                    Create Team
                                </CommandItem>
                                <CommandItem onSelect={() => {
                                    setOpen(false)
                                    setShowJoinTeamDialog(true)
                                }}>
                                    <Building2 className="mr-2 h-5 w-5" />
                                    Join Team
                                </CommandItem>
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </>
    )
}
