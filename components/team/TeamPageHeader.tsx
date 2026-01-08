"use client"

import { useLanguage } from "@/lib/useLanguage"
import { Button } from "@/components/ui/button"
import { Network, Users } from "lucide-react"
import Link from "next/link"
import { AddMemberDialog } from "./AddMemberDialog"
import { cn } from "@/lib/utils"

interface TeamPageHeaderProps {
    projectName: string | null
    membersCount: number
    isManager: boolean
}

export function TeamPageHeader({ projectName, membersCount, isManager }: TeamPageHeaderProps) {
    const { t, isRTL } = useLanguage()
    
    return (
        <div className="relative">
            {/* Modern app-like header with subtle background */}
            <div className="rounded-2xl md:rounded-3xl bg-gradient-to-br from-background to-muted/20 border border-border/50 p-4 md:p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start">
                    {/* Title Section - More app-like */}
                    <div className="space-y-2.5 md:space-y-3 flex-1 min-w-0">
                        {/* Icon + Title */}
                        <div className="flex items-center gap-2.5 md:gap-3">
                            <div className="p-2 rounded-xl bg-primary/10 dark:bg-primary/20">
                                <Users className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                            </div>
                            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
                                {t('team.teamManagement')}
                            </h1>
                        </div>
                        
                        {/* Info badges - more compact and modern */}
                        <div className="flex flex-wrap items-center gap-2 md:gap-3">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 text-xs md:text-sm font-medium text-muted-foreground">
                                <span className="font-semibold text-foreground">{membersCount}</span>
                                <span>{t('team.members')}</span>
                            </div>
                            {projectName && (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 text-xs md:text-sm text-muted-foreground">
                                    <span className="truncate max-w-[120px] md:max-w-none">
                                        {t('team.project')}: <span className="font-semibold text-foreground">{projectName}</span>
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Action Buttons - More app-like with better styling */}
                    <div className={cn(
                        "flex gap-2 md:gap-2.5 flex-shrink-0",
                        isRTL && "flex-row-reverse"
                    )}>
                        <Link href="/team/hierarchy" className="flex-1 md:flex-initial">
                            <Button 
                                variant="outline" 
                                className={cn(
                                    "w-full md:w-auto h-10 md:h-10 rounded-xl",
                                    "border-border/60 bg-background/80 backdrop-blur-sm",
                                    "hover:bg-muted/50 hover:border-border",
                                    "transition-all duration-200",
                                    "shadow-sm hover:shadow"
                                )}
                            >
                                <Network className={cn(
                                    "h-4 w-4 shrink-0",
                                    isRTL ? "ml-2" : "mr-2"
                                )} />
                                <span className="font-medium truncate">
                                    {t('team.hierarchy')}
                                </span>
                            </Button>
                        </Link>
                        {isManager && (
                            <div className="flex-1 md:flex-initial">
                                <AddMemberDialog />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

