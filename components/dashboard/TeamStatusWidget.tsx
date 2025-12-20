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
        <Card className="col-span-1 md:col-span-2 lg:col-span-1">
            <CardHeader>
                <CardTitle className="flex justify-between items-center">
                    <span>Live Team Status</span>
                    <div className="flex gap-2 text-xs font-normal">
                        <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50">
                            {workingCount} Working
                        </Badge>
                        <Badge variant="outline" className="border-yellow-500 text-yellow-600 bg-yellow-50">
                            {breakCount} Break
                        </Badge>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                    {teamStatus.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No team members found.</p>
                    ) : (
                        teamStatus.map((member) => (
                            <div key={member.userId} className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback className="bg-primary/10 text-xs">
                                            {member.name ? member.name.substring(0, 2).toUpperCase() : "??"}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-medium leading-none">{member.name || member.email}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {member.status === 'OFFLINE' ? 'Offline' : (
                                                member.status === 'WORKING' ? 'Working since ' + member.lastActive?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                                                    'On Break'
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <StatusIndicator status={member.status} />
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
