"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useLanguage } from "@/lib/useLanguage"

interface TeamMemberStatus {
    userId: string
    name: string | null
    email: string
    role: "ADMIN" | "EMPLOYEE"
    jobTitle: string | null
    status: 'WORKING' | 'BREAK' | 'OFFLINE'
    lastActive?: Date
}

interface TeamStatusWidgetProps {
    teamStatus: TeamMemberStatus[]
}

export function TeamStatusWidget({ teamStatus }: TeamStatusWidgetProps) {
    const { t } = useLanguage()
    
    return (
        <Card className="h-fit border bg-card text-card-foreground shadow-sm">
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium w-full text-center">
                    {t('team.liveTeamStatus')}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                <div className="space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar">
                    {teamStatus.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t('common.noTeamMembers')}</p>
                    ) : (
                        teamStatus.map((member) => (
                            <div key={member.userId} className="flex items-center justify-between group hover:bg-muted/50 p-2 rounded-lg transition-colors -mx-2">
                                <div className="flex items-center gap-3">
                                    <div className="relative flex-shrink-0">
                                        <Avatar className="h-9 w-9 border">
                                            <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                                                {member.name ? member.name.substring(0, 2).toUpperCase() : "??"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute -bottom-0.5 -right-0.5 ring-2 ring-background rounded-full">
                                            <StatusIndicator status={member.status} />
                                        </div>
                                    </div>
                                    <div className="min-w-0 flex-1 overflow-hidden">
                                        <p className="text-sm font-medium leading-none truncate">{member.name || member.email}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={member.jobTitle || (member.role === 'ADMIN' ? t('common.founder') : t('common.employee'))}>
                                            {member.jobTitle || (member.role === 'ADMIN' ? t('common.founder') : t('common.employee'))}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                            {member.status === 'OFFLINE' ? t('common.offline') : (
                                                member.status === 'WORKING' ? t('common.workingSince') + ' ' + member.lastActive?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                                                    t('common.onBreak')
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

function StatusIndicator({ status }: { status: TeamMemberStatus['status'] }) {
    if (status === 'WORKING') {
        return <div className="h-3 w-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
    }
    if (status === 'BREAK') {
        return <div className="h-3 w-3 rounded-full bg-yellow-400 border border-yellow-500" />
    }
    return <div className="h-3 w-3 rounded-full bg-gray-300" />
}
