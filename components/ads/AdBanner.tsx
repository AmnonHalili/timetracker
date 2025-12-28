"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useLanguage } from "@/lib/useLanguage"
import { useSession } from "next-auth/react"

const AD_INTERVAL_HOURS = 5 // Show ad every 5 hours
const STORAGE_KEY = "lastAdClosed" // When ad was last closed

export function AdBanner() {
    const { isRTL } = useLanguage()
    const { data: session } = useSession()
    const [showAd, setShowAd] = useState(false)
    const [isFreeUser, setIsFreeUser] = useState(true)

    useEffect(() => {
        if (!session) {
            setShowAd(false)
            setIsFreeUser(false)
            return
        }

        // Check subscription status
        fetch("/api/user/subscription")
            .then(res => {
                if (!res.ok) {
                    throw new Error("Failed to fetch subscription status")
                }
                return res.json()
            })
            .then(data => {
                const freeStatus = data.isFree ?? true
                setIsFreeUser(freeStatus)
                console.log("[AdBanner] Subscription status:", freeStatus ? "FREE" : "PAID")
            })
            .catch((error) => {
                console.error("Error fetching subscription status:", error)
                // Default to free on error (to show ads)
                setIsFreeUser(true)
            })
    }, [session])

    useEffect(() => {
        if (!isFreeUser || !session) {
            console.log("[AdBanner] Not showing ad - isFreeUser:", isFreeUser, "session:", !!session)
            setShowAd(false)
            return
        }

        console.log("[AdBanner] Free user detected, showing ad")

        // Always show ad immediately on every page load/visit for free users
        // Even if it was closed before, show it again on new page load
        setShowAd(true)

        // Check every minute if we should show the ad (in case 5 hours pass while user is on page)
        // This is mainly for when user closes ad and stays on page - after 5 hours it will reappear
        const interval = setInterval(() => {
            const lastClosed = localStorage.getItem(STORAGE_KEY)
            if (lastClosed) {
                const lastClosedTime = parseInt(lastClosed, 10)
                if (!isNaN(lastClosedTime)) {
                    const now = Date.now()
                    const hoursSinceLastClosed = (now - lastClosedTime) / (1000 * 60 * 60)
                    if (hoursSinceLastClosed >= AD_INTERVAL_HOURS) {
                        console.log("[AdBanner] 5+ hours passed, showing ad again")
                        setShowAd(true)
                    }
                }
            } else {
                // Never closed - show ad
                setShowAd(true)
            }
        }, 60000)

        return () => clearInterval(interval)
    }, [isFreeUser, session])

    const handleClose = () => {
        setShowAd(false)
        // Save the time when ad was closed (not when shown)
        // This way, the ad will appear again after 5 hours
        try {
            localStorage.setItem(STORAGE_KEY, Date.now().toString())
        } catch (error) {
            console.error("Error saving ad close time:", error)
        }
    }

    if (!showAd || !isFreeUser) {
        return null
    }

    return (
        <Card className={`fixed bottom-4 z-50 w-80 shadow-lg ${isRTL ? 'left-4' : 'right-4'}`}>
            <div className="relative p-4">
                <Button
                    variant="ghost"
                    size="icon"
                    className={`absolute top-2 h-6 w-6 ${isRTL ? 'left-2' : 'right-2'}`}
                    onClick={handleClose}
                    aria-label="Close ad"
                >
                    <X className="h-4 w-4" />
                </Button>
                <div className={`${isRTL ? 'pr-8 text-right' : 'pl-8 text-left'}`}>
                    <h3 className="font-semibold text-lg mb-2">Flaminga</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                        Rent your dress here
                    </p>
                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-2xl">🦩</span>
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground">
                                Discover beautiful dresses for rent
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    )
}

