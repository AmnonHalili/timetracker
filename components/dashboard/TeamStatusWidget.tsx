import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface TeamMemberStatus {
    userId: string
    name: string | null
    email: string
    status: 'WORKING' | 'BREAK' | 'OFFLINE'
    lastActive?: Date
}

interface TeamStatusWidgetProps {
    teamStatus: TeamMemberStatus[]
}

export function TeamStatusWidget({ teamStatus }: TeamStatusWidgetProps) {
    const workingCount = teamStatus.filter(m => m.status === 'WORKING').length
    const breakCount = teamStatus.filter(m => m.status === 'BREAK').length
    const offlineCount = teamStatus.filter(m => m.status === 'OFFLINE').length

    return (
        <Card className="h-full min-h-[500px] border bg-card text-card-foreground shadow-sm">
            <CardHeader className="pb-3 place-items-start">
                <CardTitle className="text-base font-medium flex flex-col gap-2 w-full">
                    <span>Live Team Status</span>
                    <div className="flex gap-2 text-[10px] font-normal w-full">
                        <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50 px-2 py-0.5 h-5">
                            {workingCount} Working
                        </Badge>
                        <Badge variant="outline" className="border-yellow-500 text-yellow-600 bg-yellow-50 px-2 py-0.5 h-5">
                            {breakCount} Break
                        </Badge>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 custom-scrollbar">
                    {teamStatus.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No team members found.</p>
                    ) : (
                        teamStatus.map((member) => (
                            <div key={member.userId} className="flex items-center justify-between group hover:bg-muted/50 p-2 rounded-lg transition-colors -mx-2">
                                <div className="flex items-center space-x-3">
                                    <div className="relative">
                                        <Avatar className="h-9 w-9 border">
                                            <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                                                {member.name ? member.name.substring(0, 2).toUpperCase() : "??"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute -bottom-0.5 -right-0.5 ring-2 ring-background rounded-full">
                                            <StatusIndicator status={member.status} />
                                        </div>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium leading-none truncate">{member.name || member.email}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1 truncate">
                                            {member.status === 'OFFLINE' ? 'Offline' : (
                                                member.status === 'WORKING' ? 'Working since ' + member.lastActive?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                                                    'On Break'
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
