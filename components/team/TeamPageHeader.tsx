"use client"

import { useLanguage } from "@/lib/useLanguage"
import { Button } from "@/components/ui/button"
import { Network } from "lucide-react"
import Link from "next/link"
import { AddMemberDialog } from "./AddMemberDialog"

interface TeamPageHeaderProps {
    projectName: string | null
    membersCount: number
    isManager: boolean
}

export function TeamPageHeader({ projectName, membersCount, isManager }: TeamPageHeaderProps) {
    const { t } = useLanguage()
    
    return (
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t('team.teamManagement')}</h1>
                <p className="text-muted-foreground">
                    {membersCount} {t('team.members')}
                    <span className="mx-2">•</span>
                    {t('team.project')} : <span className="font-semibold text-foreground">{projectName}</span>
                </p>
            </div>
            <div className="flex gap-2">
                <Link href="/team/hierarchy">
                    <Button variant="outline">
                        <Network className="h-4 w-4 mr-2" />
                        {t('team.viewHierarchy')}
                    </Button>
                </Link>
                {isManager && <AddMemberDialog />}
            </div>
        </div>
    )
}

