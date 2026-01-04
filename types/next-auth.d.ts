import { Role, Status } from "@prisma/client"
import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
    /**
     * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
     */
    interface Session {
        user: {
            id: string
            role: Role
            status: Status
            managerId?: string | null
            workDays?: number[]
            dailyTarget?: number | null
            plan: string
            projectId?: string | null
        } & DefaultSession["user"]
    }

    interface User {
        id: string
        role: Role
        status: Status
        managerId?: string | null
        workDays?: number[]
        dailyTarget?: number | null
        plan: string
        projectId?: string | null
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string
        role: Role
        status: Status
        managerId?: string | null
        workDays?: number[]
        dailyTarget?: number | null
        plan: string
        projectId?: string | null
    }
}
