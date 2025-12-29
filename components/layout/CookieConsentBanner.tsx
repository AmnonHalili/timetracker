"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useLanguage } from "@/lib/useLanguage";

interface CookieConsentBannerProps {
    onAccept?: () => void;
}

export function CookieConsentBanner({ onAccept }: CookieConsentBannerProps) {
    const { t, isRTL } = useLanguage();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Check if user has already made a choice
        const consent = localStorage.getItem("cookie_consent");
        if (!consent) {
            // Small delay to show animation or just to wait for mount
            const timer = setTimeout(() => setIsVisible(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem("cookie_consent", "accepted");
        setIsVisible(false);
        if (onAccept) {
            onAccept();
        }

        // Example: Trigger Google Analytics or other scripts here
        // console.log("Cookies accepted - initializing analytics");
        // initGoogleAnalytics(); // Your custom initialization function    }
    };

    const handleDecline = () => {
        // Optionally handle decline - usually just hide or store 'declined'
        localStorage.setItem("cookie_consent", "declined");
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className={`fixed bottom-0 left-0 right-0 z-50 p-4 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] transition-transform duration-500 ease-in-out ${isRTL ? 'text-right' : 'text-left'}`}>
            <div className={`container mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`text-sm text-zinc-600 dark:text-zinc-400 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <p>
                        {t('common.cookies.message')}{' '}
                        <Link href="/privacy-policy" className="underline underline-offset-2 hover:text-primary">
                            {t('common.cookies.privacyPolicy')}
                        </Link>
                        {' '}{t('common.cookies.learnMore')}
                    </p>
                </div>
                <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <Button variant="outline" size="sm" onClick={handleDecline}>
                        {t('common.cookies.decline')}
                    </Button>
                    <Button size="sm" onClick={handleAccept}>
                        {t('common.cookies.accept')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
