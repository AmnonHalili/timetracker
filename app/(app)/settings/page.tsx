import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileForm, SecurityForm, PreferencesForm } from "@/components/settings/SettingsForms"

export default async function SettingsPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/login")
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            dailyTarget: true
        }
    })

    if (!user) return null

    return (
        <div className="container max-w-4xl py-6 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">Manage your account settings and preferences.</p>
            </div>

            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="w-full justify-start h-auto p-1 bg-muted/50 rounded-lg">
                    <TabsTrigger value="profile" className="flex-1 max-w-[200px]">Profile</TabsTrigger>
                    <TabsTrigger value="preferences" className="flex-1 max-w-[200px]">Preferences</TabsTrigger>
                    <TabsTrigger value="security" className="flex-1 max-w-[200px]">Security</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="mt-6">
                    <ProfileForm user={user} />
                </TabsContent>

                <TabsContent value="preferences" className="mt-6">
                    <PreferencesForm user={user} />
                </TabsContent>

                <TabsContent value="security" className="mt-6">
                    <SecurityForm />
                </TabsContent>
            </Tabs>
        </div>
    )
}
