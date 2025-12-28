"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Loader2, ChevronLeft } from "lucide-react"
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton"
import { useLanguage } from "@/lib/useLanguage"

export default function LoginPage() {
    const router = useRouter()
    const { t, isRTL } = useLanguage()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            const res = await signIn("credentials", {
                email,
                password,
                redirect: false,
            })

            if (res?.error) {
                setError(res.error)
            } else {
                router.push("/dashboard")
                router.refresh()
            }
        } catch {
            setError(t('auth.errorOccurred'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full max-w-md space-y-4">
            <Link
                href="/"
                className={`inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
            >
                {t('auth.backToHome')}
                <ChevronLeft className={`h-4 w-4 ${isRTL ? 'mr-1 rotate-180' : 'ml-1'}`} />
            </Link>
            <Card className="w-full">
                <CardHeader>
                    <CardTitle className={isRTL ? 'text-right' : 'text-left'}>{t('auth.welcomeBack')}</CardTitle>
                    <CardDescription className={isRTL ? 'text-right' : 'text-left'}>{t('auth.signInToAccount')}</CardDescription>
                </CardHeader>
                <div className="mb-4 px-6">
                    <GoogleLoginButton />
                </div>
                <div className="relative mb-4 px-6">
                    <div className="absolute inset-0 flex items-center px-6">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                            {t('auth.orContinueWith')}
                        </span>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {error && (
                            <div className="flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive" role="alert" aria-live="assertive">
                                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                                <p>{error}</p>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email" className={isRTL ? 'text-right' : 'text-left'}>{t('auth.email')}</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                dir="ltr"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className={isRTL ? 'text-right' : 'text-left'}>{t('auth.password')}</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                dir="ltr"
                            />
                        </div>
                        <div className={`flex items-center ${isRTL ? 'justify-start' : 'justify-end'}`}>
                            <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-2 py-1">
                                {t('auth.forgotPassword')}
                            </Link>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading && <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} aria-hidden="true" />}
                            {t('auth.signIn')}
                        </Button>
                        <div className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-center'}`}>
                            {t('auth.dontHaveAccount')}{" "}
                            <Link href="/register" className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-1">
                                {t('auth.signUp')}
                            </Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
