import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AccessibilityButton } from "@/components/accessibility/AccessibilityButton"
import { LandingPageContent } from "@/components/landing/LandingPageContent"

export const dynamic = "force-dynamic"

export default async function Home() {
  try {
    const session = await getServerSession(authOptions)
    if (session) {
      redirect("/dashboard")
    }
  } catch (error) {
    console.error("Failed to retrieve session:", error)
    // Fallback: render landing page if auth/DB fails
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingPageContent />
      <AccessibilityButton />
    </div>
  )
}
