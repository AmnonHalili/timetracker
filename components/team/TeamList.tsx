"use client"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

interface User {
    id: string
    name: string
    email: string
    role: string
    status: string
    createdAt: Date
}

interface TeamListProps {
    users: User[]
}

export function TeamList({ users }: TeamListProps) {
    if (users.length === 0) {
        return <div className="text-center text-muted-foreground py-8">No team members yet.</div>
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Joined</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map((user) => (
                        <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                                <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                                    {user.role}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className={
                                    user.status === "ACTIVE" ? "text-green-600 border-green-600" :
                                        user.status === "PENDING" ? "text-yellow-600 border-yellow-600" : ""
                                }>
                                    {user.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                {format(new Date(user.createdAt), 'MMM d, yyyy')}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
