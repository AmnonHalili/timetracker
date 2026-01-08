"use client"

import { useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"

/**
 * Prevents navigation back to login/register pages after user is authenticated
 * This handles the case where mobile users use swipe-back gesture
 */
export function PreventBackToAuth() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const pathname = usePathname()
    const hasRedirectedRef = useRef(false)

    useEffect(() => {
        // Only run if user is authenticated
        if (status !== "authenticated" || !session) {
            hasRedirectedRef.current = false
            return
        }

        // List of auth pages that should not be accessible after login
        const authPages = ["/login", "/register", "/forgot-password", "/reset-password"]

        // Check if current path is an auth page
        const isAuthPage = authPages.some(page => pathname?.startsWith(page))

        // If user is on an auth page while authenticated, redirect to dashboard
        if (isAuthPage && !hasRedirectedRef.current) {
            hasRedirectedRef.current = true
            // Replace history entry to prevent back navigation
            window.history.replaceState(null, "", "/dashboard")
            router.replace("/dashboard")
            return
        }

        // Reset redirect flag when not on auth page
        if (!isAuthPage) {
            hasRedirectedRef.current = false
        }

        // Handle browser back/forward navigation (including mobile swipe-back gesture)
        const handlePopState = () => {
            if (!session) return

            // Check current URL after popstate
            const currentUrl = window.location.pathname
            const isAuthPageAfterPop = authPages.some(page => currentUrl.startsWith(page))

            if (isAuthPageAfterPop) {
                // Prevent navigation to auth page by pushing dashboard to history
                window.history.pushState(null, "", "/dashboard")
                router.replace("/dashboard")
            }
        }

        // Listen to popstate events (back/forward navigation)
        window.addEventListener("popstate", handlePopState)

        return () => {
            window.removeEventListener("popstate", handlePopState)
        }
    }, [session, status, router, pathname])

    return null
}

