import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AccessibilityButton } from "@/components/accessibility/AccessibilityButton"
import { LandingPageContent } from "@/components/landing/LandingPageContent"

export const dynamic = "force-dynamic"

export default async function Home() {
  let session = null;
  try {
    session = await getServerSession(authOptions)
  } catch (error) {
    console.error("Failed to retrieve session:", error)
    // Fallback: render landing page if auth/DB fails
  }

  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingPageContent />
      <footer className="py-6 text-center text-sm text-gray-500 space-x-4">
        <a href="/privacy" className="hover:underline">Privacy Policy</a>
        <span>&bull;</span>
        <a href="/terms" className="hover:underline">Terms of Service</a>
      </footer>
      <AccessibilityButton />
    </div>
  )
}
