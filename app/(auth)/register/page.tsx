"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Loader2, ChevronLeft } from "lucide-react"

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
                className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
            >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back to Home
            </Link>
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Create an Account</CardTitle>
                    <CardDescription>Enter your details to register</CardDescription>
                </CardHeader>
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
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
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
