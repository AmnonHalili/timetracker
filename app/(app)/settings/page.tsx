import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileForm, SecurityForm, PreferencesForm } from "@/components/settings/SettingsForms"
import { AppearanceForm } from "@/components/settings/AppearanceForm"
import { CompanyForm } from "@/components/settings/CompanyForm"

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
            jobTitle: true,
            dailyTarget: true,
            workDays: true,
            workMode: true,
            role: true,
            projectId: true,
            project: {
                select: { name: true, workMode: true, joinCode: true }
            }
        }
    })

    if (!user) return null

    return (
        <div className="container max-w-4xl py-6 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">Manage your account settings.</p>
            </div>

            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="w-full justify-start h-auto p-1 bg-muted/50 rounded-lg overflow-x-auto">
                    <TabsTrigger value="profile" className="flex-1 min-w-[100px]">Profile</TabsTrigger>
                    <TabsTrigger value="preferences" className="flex-1 min-w-[100px]">Preferences</TabsTrigger>
                    <TabsTrigger value="security" className="flex-1 min-w-[100px]">Security</TabsTrigger>
                    <TabsTrigger value="appearance" className="flex-1 min-w-[100px]">Appearance</TabsTrigger>
                    {user.role === "ADMIN" && user.projectId && (
                        <TabsTrigger value="workspace" className="flex-1 min-w-[100px]">Workspace</TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="profile" className="mt-6">
                    <ProfileForm user={{
                        name: user.name,
                        email: user.email,
                        image: user.image,
                        jobTitle: user.jobTitle,
                        role: user.role,
                        projectId: user.projectId
                    }} />
                </TabsContent>

                <TabsContent value="preferences" className="mt-6">
                    <PreferencesForm user={{
                        dailyTarget: user.dailyTarget,
                        workDays: user.workDays,
                        workMode: user.workMode,
                        role: user.role,
                        projectId: user.projectId
                    }} />
                </TabsContent>

                <TabsContent value="security" className="mt-6">
                    <SecurityForm user={{
                        role: user.role,
                        projectId: user.projectId
                    }} />
                </TabsContent>

                <TabsContent value="appearance" className="mt-6">
                    <AppearanceForm />
                </TabsContent>


                {user.role === "ADMIN" && user.projectId && (
                    <TabsContent value="workspace" className="mt-6">
                        <CompanyForm
                            initialName={user.project?.name || ""}
                            initialWorkMode={user.project?.workMode}
                            projectId={user.projectId}
                            joinCode={user.project?.joinCode || "No Code"}
                        />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    )
}
