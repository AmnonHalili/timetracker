"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Loader2, ChevronLeft, Eye, EyeOff } from "lucide-react"

import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"

import { Suspense } from "react"
import { validatePassword } from "@/lib/password-validation"
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton"
import { useLanguage } from "@/lib/useLanguage"

function RegisterForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { t } = useLanguage()
    const initialRole = searchParams.get("role") === "manager" ? "ADMIN" : "EMPLOYEE"

    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [role, setRole] = useState<"EMPLOYEE" | "ADMIN">(initialRole)
    const [projectName, setProjectName] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        const validation = validatePassword(password)
        if (!validation.isValid) {
            setError(validation.message || "Invalid password")
            return
        }

        setLoading(true)

        try {
            const res = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password, role, projectName }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.message || "Something went wrong")
            }

            // Auto-login for ALL users (Admin and Employee)
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            })

            if (result?.error) {
                throw new Error("Registration successful, but login failed. Please log in manually.")
            }

            router.push("/dashboard")
            router.refresh()
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "An error occurred"
            console.error("Client Error:", errorMessage)
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
    }



    return (
        <div className="w-full max-w-md space-y-4">
            <Link
                href="/"
                className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors flex-row-reverse md:flex-row"
            >
                <ChevronLeft className="mr-1 md:ml-1 md:mr-0 h-4 w-4" />
                Back to Home
            </Link>
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Create an Account</CardTitle>
                    <CardDescription>Enter your details to register</CardDescription>
                </CardHeader>
                <div className="mb-4 px-6">
                    <GoogleLoginButton
                        text={t('auth.signUpWithGoogle')}
                        role={role}
                        projectInfo={projectName}
                    />
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
                        <div className="flex gap-4 mb-4">
                            <Button
                                type="button"
                                variant={role === "EMPLOYEE" ? "default" : "outline"}
                                className="w-1/2"
                                onClick={() => setRole("EMPLOYEE")}
                            >
                                Join as Member
                            </Button>
                            <Button
                                type="button"
                                variant={role === "ADMIN" ? "default" : "outline"}
                                className="w-1/2"
                                onClick={() => setRole("ADMIN")}
                            >
                                Create Team
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md p-1"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {role === "EMPLOYEE" && (
                            <div className="space-y-2">
                                <Label htmlFor="joinProjectName">Enter Team Code (Optional)</Label>
                                <Input
                                    id="joinProjectName"
                                    placeholder="Enter 6-character Team Code"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    An admin will need to approve your request.
                                </p>
                            </div>
                        )}

                        {role === "ADMIN" && (
                            <div className="space-y-2">
                                <Label htmlFor="projectName">Team / Project Name</Label>
                                <Input
                                    id="projectName"
                                    placeholder="Acme Inc."
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    required
                                />
                                <p className="text-xs text-muted-foreground">
                                    You will be the admin of this project.
                                </p>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                            Create
                        </Button>
                        <div className="text-center text-sm text-muted-foreground">
                            Already have an account?{" "}
                            <Link href="/login" className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-1">
                                Sign in
                            </Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}

export default function RegisterPage() {
    return (
        <Suspense fallback={<div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <RegisterForm />
        </Suspense>
    )
}
