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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// Mock Data for UI Visualization
const teams = [
    {
        label: "Flaminga",
        value: "flaminga",
        plan: "Free",
        initials: "FL",
        image: "/flamingo.png"
    },
]

type Team = {
    label: string
    value: string
    plan: string
    initials: string
    image: string | null
}

export function ProjectSwitcher({ className }: { className?: string }) {
    const [open, setOpen] = React.useState(false)
    const [selectedTeam, setSelectedTeam] = React.useState<Team>(teams[0])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label="Select a team"
                    className={cn("w-full justify-between h-12 px-3 border-dashed", className)}
                >
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
                    <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
                <Command>
                    <CommandList>
                        <CommandInput placeholder="Search team..." />
                        <CommandEmpty>No team found.</CommandEmpty>
                        <CommandGroup>
                            {teams.map((team) => (
                                <CommandItem
                                    key={team.value}
                                    onSelect={() => {
                                        setSelectedTeam(team)
                                        setOpen(false)
                                    }}
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
                                            selectedTeam.value === team.value
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
                            <CommandItem
                                onSelect={() => {
                                    setOpen(false)
                                }}
                            >
                                <PlusCircle className="mr-2 h-5 w-5" />
                                Create Team
                            </CommandItem>
                            <CommandItem
                                onSelect={() => {
                                    setOpen(false)
                                }}
                            >
                                <Building2 className="mr-2 h-5 w-5" />
                                Join Team
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
