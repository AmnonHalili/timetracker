import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { ProfileForm, SecurityForm, LanguageForm } from "@/components/settings/SettingsForms"
import { AppearanceForm } from "@/components/settings/AppearanceForm"
import { CompanyForm } from "@/components/settings/CompanyForm"
import { WorkLocationForm } from "@/components/settings/WorkLocationForm"
import { SettingsHeader } from "@/components/settings/SettingsHeader"
import { SettingsTabs } from "@/components/settings/SettingsTabs"

export default async function SettingsPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/login")
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let user: any = null

    try {
        // Try to fetch full user details including new schema fields
        user = await prisma.user.findUnique({
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
                managerId: true,
                manager: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                        jobTitle: true
                    }
                },
                secondaryManagers: {
                    include: {
                        manager: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                image: true,
                                jobTitle: true
                            }
                        }
                    }
                },
                project: {
                    select: {
                        name: true,
                        workMode: true,
                        joinCode: true,
                        workLocationLatitude: true,
                        workLocationLongitude: true,
                        workLocationRadius: true,
                        workLocationAddress: true,
                        isRemoteWork: true,
                    }
                }
            }
        })
    } catch (e) {
        console.warn("Failed to fetch full user details, falling back to basic query:", e)
        // Fallback for stale Prisma client
        user = await prisma.user.findUnique({
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
                // Basic fields only
                project: {
                    select: {
                        name: true,
                        workMode: true,
                        joinCode: true,
                        workLocationLatitude: true,
                        workLocationLongitude: true,
                        workLocationRadius: true,
                        workLocationAddress: true,
                        isRemoteWork: true,
                    }
                }
            }
        })
        // Add null/empty values for missing fields
        if (user) {
            user.manager = null
            user.secondaryManagers = []
            user.managerId = null
        }
    }

    if (!user) return null

    return (
        <div className="container max-w-4xl py-6 space-y-8 px-2 md:px-4">
            <SettingsHeader />

            <Tabs defaultValue="profile" className="w-full">
                <SettingsTabs userRole={user.role} hasProject={!!user.projectId} />

                <TabsContent value="profile" className="mt-6 space-y-6">
                    <ProfileForm user={{
                        name: user.name,
                        email: user.email,
                        image: user.image,
                        jobTitle: user.jobTitle,
                        role: user.role,
                        projectId: user.projectId,
                        dailyTarget: user.dailyTarget,
                        workDays: user.workDays,
                        workMode: user.workMode
                    }} />
                </TabsContent>

                <TabsContent value="language" className="mt-6">
                    <LanguageForm />
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
                    <TabsContent value="workspace" className="mt-6 space-y-6">
                        <CompanyForm
                            initialName={user.project?.name || ""}
                            projectId={user.projectId}
                            joinCode={user.project?.joinCode || "No Code"}
                        />
                        <WorkLocationForm
                            projectId={user.projectId}
                            initialLocation={
                                user.project?.workLocationLatitude && user.project?.workLocationLongitude
                                    ? {
                                        latitude: user.project.workLocationLatitude,
                                        longitude: user.project.workLocationLongitude,
                                        radius: user.project.workLocationRadius || 150,
                                        address: user.project.workLocationAddress || undefined,
                                    }
                                    : null
                            }
                            initialIsRemoteWork={user.project?.isRemoteWork || false}
                        />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    )
}
