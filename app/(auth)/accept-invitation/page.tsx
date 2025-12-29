"use client"

import { useState, useEffect, Suspense } from "react"
import { validatePassword } from "@/lib/password-validation"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react"
import Image from "next/image"

function AcceptInvitationContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get("token")

    const [loading, setLoading] = useState(true)
    const [valid, setValid] = useState(false)
    const [invitationData, setInvitationData] = useState<{
        email: string
        projectName: string
        role: string
        jobTitle?: string | null
    } | null>(null)

    const [name, setName] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)

    // Validate invitation on mount
    useEffect(() => {
        const validateInvitation = async () => {
            if (!token) {
                setError("No invitation token provided")
                setValid(false)
                setLoading(false)
                return
            }

            try {
                const res = await fetch(`/api/auth/validate-invitation?token=${token}`)
                const data = await res.json()

                if (res.ok && data.valid) {
                    setValid(true)
                    setInvitationData(data)
                } else {
                    setError(data.message || "Invalid invitation link")
                    setValid(false)
                }
            } catch {
                setError("Failed to validate invitation")
                setValid(false)
            } finally {
                setLoading(false)
            }
        }

        validateInvitation()
    }, [token])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        // Validate form
        if (!name.trim()) {
            setError("Please enter your full name")
            return
        }

        const validation = validatePassword(password)
        if (!validation.isValid) {
            setError(validation.message || "Invalid password")
            return
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match")
            return
        }

        setSubmitting(true)

        try {
            const res = await fetch("/api/auth/accept-invitation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, name, password })
            })

            const data = await res.json()

            if (res.ok) {
                setSuccess(true)
                // Redirect to login after 2 seconds
                setTimeout(() => {
                    router.push("/login?message=Account activated! Please log in.")
                }, 2000)
            } else {
                setError(data.message || "Failed to activate account")
            }
        } catch {
            setError("An error occurred. Please try again.")
        } finally {
            setSubmitting(false)
        }
    }

    // Password strength indicator
    const getPasswordStrength = () => {
        if (!password) return { label: "", color: "" }
        if (password.length < 8) return { label: "Too short", color: "text-destructive" }
        if (password.length < 12) return { label: "Fair", color: "text-orange-500" }
        if (password.length < 16) return { label: "Good", color: "text-yellow-500" }
        return { label: "Strong", color: "text-green-500" }
    }

    const strength = getPasswordStrength()

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="mt-4 text-muted-foreground">Validating invitation...</p>
                </div>
            </div>
        )
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <CardTitle className="text-2xl">Account Activated!</CardTitle>
                        <CardDescription>
                            Your account has been successfully activated. Redirecting to login...
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        )
    }

    if (!valid) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                            <XCircle className="h-6 w-6 text-destructive" />
                        </div>
                        <CardTitle className="text-2xl">Invalid Invitation</CardTitle>
                        <CardDescription>{error || "This invitation link is invalid or has expired."}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-sm text-muted-foreground mb-4">
                            Please contact your administrator for a new invitation link.
                        </p>
                        <Link href="/login">
                            <Button variant="outline">Go to Login</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center space-y-4">
                    <div className="flex justify-center">
                        <Image src="/collabologo.png" alt="Collabo" width={180} height={60} style={{ width: 'auto', height: '60px' }} />
                    </div>
                    <div>
                        <CardTitle className="text-2xl">Complete Your Registration</CardTitle>
                        <CardDescription className="mt-2">
                            You&apos;ve been invited to join <strong>{invitationData?.projectName}</strong>
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {/* Read-only Email */}
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={invitationData?.email || ""}
                                disabled
                                className="bg-muted"
                            />
                        </div>

                        {/* Full Name */}
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name *</Label>
                            <Input
                                id="name"
                                type="text"
                                placeholder="John Doe"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <Label htmlFor="password">Password *</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter a strong password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {password && (
                                <p className={`text-xs ${strength.color}`}>
                                    Strength: {strength.label}
                                </p>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm Password *</Label>
                            <div className="relative">
                                <Input
                                    id="confirmPassword"
                                    type={showConfirm ? "text" : "password"}
                                    placeholder="Re-enter your password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(!showConfirm)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <Button type="submit" className="w-full" disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Activate Account
                        </Button>

                        <p className="text-center text-xs text-muted-foreground">
                            Already have an account?{" "}
                            <Link href="/login" className="text-primary hover:underline">
                                Log in
                            </Link>
                        </p>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}

export default function AcceptInvitationPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="mt-4 text-muted-foreground">Loading...</p>
                </div>
            </div>
        }>
            <AcceptInvitationContent />
        </Suspense>
    )
}
