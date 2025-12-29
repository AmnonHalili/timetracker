"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/useLanguage"

interface GoogleLoginButtonProps {
    text?: string
    role?: "ADMIN" | "EMPLOYEE"
    projectInfo?: string
}

export function GoogleLoginButton({ text, role, projectInfo }: GoogleLoginButtonProps) {
    const { t } = useLanguage()

    const handleLogin = () => {
        // Store registration context in cookies
        if (role) {
            document.cookie = `regist_role=${role}; path=/; max-age=300`
        }
        if (projectInfo) {
            document.cookie = `regist_project=${encodeURIComponent(projectInfo)}; path=/; max-age=300`
        }

        signIn("google", { callbackUrl: "/dashboard" })
    }

    return (
        <Button
            className="w-full flex items-center justify-center gap-2"
            variant="outline"
            type="button"
            onClick={handleLogin}
        >
            <svg className="h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
            </svg>
            {text || t('auth.signInWithGoogle')}
        </Button>
    )
}
