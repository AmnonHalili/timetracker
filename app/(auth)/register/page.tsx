"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react"

import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"

import { Suspense } from "react"

function RegisterForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const initialRole = searchParams.get("role") === "manager" ? "ADMIN" : "EMPLOYEE"

    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [role, setRole] = useState<"EMPLOYEE" | "ADMIN">(initialRole)
    const [projectName, setProjectName] = useState("")
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
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

            if (role === "ADMIN") {
                // Auto-login for Admins
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
            } else {
                // Show success message for Employees (Pending Approval)
                setSuccess(true)
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred during registration")
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <Card className="w-full max-w-md">
                <CardHeader>
                    <div className="mb-2 flex justify-center">
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                    </div>
                    <CardTitle className="text-center">Registration Successful</CardTitle>
                    <CardDescription className="text-center">
                        Your account has been created and is pending approval.
                        <br />
                        You will be able to log in once an administrator approves your account.
                    </CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button className="w-full" asChild>
                        <Link href="/login">Return to Login</Link>
                    </Button>
                </CardFooter>
            </Card>
        )
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle>Create an Account</CardTitle>
                <CardDescription>Enter your details to register</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4" />
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
                            Join a Team
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
                            placeholder="John Doe"
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
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

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
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Register
                    </Button>
                    <div className="text-center text-sm text-muted-foreground">
                        Already have an account?{" "}
                        <Link href="/login" className="text-primary hover:underline">
                            Sign in
                        </Link>
                    </div>
                </CardFooter>
            </form>
        </Card>
    )
}

export default function RegisterPage() {
    return (
        <Suspense fallback={<div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
            <RegisterForm />
        </Suspense>
    )
}
