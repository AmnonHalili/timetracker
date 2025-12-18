import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary">
      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
              WorkTracker
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8">
              A minimalist work hours and task tracker with real-time balance calculation
            </p>
            <div className="flex justify-center gap-4">
              <a href="/login" className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
                Log In
              </a>
              <a href="/register" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-8 py-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
                Register
              </a>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <div className="bg-card border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-xl font-semibold mb-3 text-card-foreground">🔐 Authentication</h2>
              <p className="text-muted-foreground text-sm">
                Secure registration with admin approval workflow. New users start as PENDING and must be approved by an admin.
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-xl font-semibold mb-3 text-card-foreground">⏱️ Time Tracking</h2>
              <p className="text-muted-foreground text-sm">
                Track work hours with a timer or manual entry. Real-time balance calculation shows if you&apos;re ahead or behind.
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-xl font-semibold mb-3 text-card-foreground">📊 Reports</h2>
              <p className="text-muted-foreground text-sm">
                View monthly breakdowns of work hours and track your progress over time with detailed reports.
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
              <h2 className="text-xl font-semibold mb-3 text-card-foreground">✅ Tasks</h2>
              <p className="text-muted-foreground text-sm">
                Admins can assign tasks to users. Track task status from TODO to COMPLETED with priority levels.
              </p>
            </div>
          </div>

          {/* Tech Stack */}
          <div className="bg-card border border-border rounded-lg p-8 shadow-sm">
            <h2 className="text-2xl font-semibold mb-6 text-center text-card-foreground">Built With Modern Technologies</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4">
                <div className="text-3xl mb-2">⚡</div>
                <div className="font-semibold text-sm">Next.js 14</div>
                <div className="text-xs text-muted-foreground">App Router</div>
              </div>
              <div className="p-4">
                <div className="text-3xl mb-2">📘</div>
                <div className="font-semibold text-sm">TypeScript</div>
                <div className="text-xs text-muted-foreground">Type Safety</div>
              </div>
              <div className="p-4">
                <div className="text-3xl mb-2">🗄️</div>
                <div className="font-semibold text-sm">Prisma</div>
                <div className="text-xs text-muted-foreground">Neon DB</div>
              </div>
              <div className="p-4">
                <div className="text-3xl mb-2">🎨</div>
                <div className="font-semibold text-sm">Tailwind</div>
                <div className="text-xs text-muted-foreground">shadcn/ui</div>
              </div>
            </div>
          </div>

          {/* Setup Instructions */}
          <div className="mt-12 bg-muted rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Start</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li>1. Configure your database connection in <code className="bg-background px-2 py-1 rounded text-foreground">.env</code></li>
              <li>2. Generate Prisma client: <code className="bg-background px-2 py-1 rounded text-foreground">npm run prisma:generate</code></li>
              <li>3. Push database schema: <code className="bg-background px-2 py-1 rounded text-foreground">npm run prisma:push</code></li>
              <li>4. Start development: <code className="bg-background px-2 py-1 rounded text-foreground">npm run dev</code></li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
