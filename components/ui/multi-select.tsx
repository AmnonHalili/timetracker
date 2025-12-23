"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

export type Option = {
    label: string
    value: string
}

interface MultiSelectProps {
    options: Option[]
    selected: string[]
    onChange: (selected: string[]) => void
    placeholder?: string
    className?: string
    maxCount?: number
}

export function MultiSelect({
    options,
    selected,
    onChange,
    placeholder = "Select items...",
    className,
    maxCount = 2,
}: MultiSelectProps) {
    const [open, setOpen] = React.useState(false)

    const handleSelect = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter((item) => item !== value))
        } else {
            onChange([...selected, value])
        }
    }

    const handleRemove = (value: string) => {
        onChange(selected.filter((item) => item !== value))
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between h-auto min-h-10 hover:bg-background/50 bg-background/50 border-input",
                        className
                    )}
                >
                    <div className="flex flex-wrap gap-1 items-center">
                        {selected.length === 0 && (
                            <span className="text-muted-foreground font-normal">{placeholder}</span>
                        )}
                        {selected.length > 0 && selected.slice(0, maxCount).map((value) => {
                            const option = options.find((o) => o.value === value)
                            return (
                                <Badge variant="secondary" key={value} className="mr-1 mb-0.5 max-w-[150px] inline-flex items-center">
                                    <span className="truncate" title={option?.label}>
                                        {option?.label}
                                    </span>
                                    <div
                                        className="ml-1 shrink-0 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                handleRemove(value)
                                            }
                                        }}
                                        onMouseDown={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                        }}
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            handleRemove(value)
                                        }}
                                    >
                                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                    </div>
                                </Badge>
                            )
                        })}
                        {selected.length > maxCount && (
                            <Badge variant="secondary" className="mr-1 mb-0.5 pointer-events-none">
                                +{selected.length - maxCount} more
                            </Badge>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search..." />
                    <CommandList>
                        <CommandEmpty>No item found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label} // Search by label
                                    onSelect={() => {
                                        handleSelect(option.value)
                                        // setOpen(false) // Keep open for multi select
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            selected.includes(option.value) ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
