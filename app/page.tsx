import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ArrowRight, CheckCircle2, Clock, Users, BarChart3, ShieldCheck } from "lucide-react"
export const dynamic = "force-dynamic"

export default async function Home() {
  try {
    const session = await getServerSession(authOptions)
    if (session) {
      redirect("/dashboard")
    }
  } catch (error) {
    console.error("Failed to retrieve session:", error)
    // Fallback: render landing page if auth/DB fails
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar / Header */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-24 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Collabo Logo" width={200} height={80} className="h-20 w-auto" />
          </div>
          <div className="flex items-center gap-4">
            <a href="/login" className="text-sm font-medium hover:text-primary transition-colors">
              Log In
            </a>
            <a href="/register" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors">
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 md:py-32 overflow-hidden">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            Master Your Time, <br className="hidden md:block" />
            <span className="text-primary">Lead Your Team</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            The all-in-one platform for tracking work hours, managing projects, and leading teams.
            Simple enough for freelancers, powerful enough for high-growth teams.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a href="/register" className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-3 text-lg font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105">
              Start Your Project <ArrowRight className="ml-2 h-5 w-5" />
            </a>
            <a href="/login" className="inline-flex items-center justify-center rounded-full border border-input bg-background px-8 py-3 text-lg font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-all">
              Log In
            </a>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Clock className="h-10 w-10 text-primary" />}
              title="Smart Time Tracking"
              description="Track hours with a precise timer or manual entry. See your daily progress and balance in real-time."
            />
            <FeatureCard
              icon={<Users className="h-10 w-10 text-primary" />}
              title="Project Management"
              description="Create projects and invite team members. As a manager, you oversee your team's tasks and performance."
            />
            <FeatureCard
              icon={<BarChart3 className="h-10 w-10 text-primary" />}
              title="Detailed Reports"
              description="Get visual insights into productivity. Export monthly reports and track attendance trends effortlessly."
            />
            <FeatureCard
              icon={<ShieldCheck className="h-10 w-10 text-primary" />}
              title="Role-Based Access"
              description="Secure hierarchies. Managers control projects and approve users, while employees focus on their tasks."
            />
          </div>
        </div>
      </section>

      {/* Project Management Spotlight */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary font-semibold">
                For Managers & Leaders
              </div>
              <h2 className="text-3xl md:text-4xl font-bold">Take Control of Your Projects</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Collabo isn&apos;t just for individuals. It&apos;s built for teams.
                Open a new project and become the <strong>Project Manager</strong> instantly.
              </p>
              <ul className="space-y-4 pt-4">
                <CheckItem text="Create customized projects" />
                <CheckItem text="Add users directly under your supervision" />
                <CheckItem text="Assign tasks and track completion status" />
                <CheckItem text="Monitor team hours and productivity" />
              </ul>
              <div className="pt-6">
                <a href="/register?role=manager" className="text-primary font-medium hover:underline inline-flex items-center">
                  Create a Manager Account <ArrowRight className="ml-1 h-4 w-4" />
                </a>
              </div>
            </div>
            <div className="relative h-[400px] w-full rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 border shadow-2xl overflow-hidden flex items-center justify-center p-8">
              {/* Abstract UI representation */}
              <div className="absolute inset-0 bg-grid-slate-200 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-800/50"></div>
              <div className="relative bg-background rounded-xl shadow-lg border p-6 w-full max-w-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                    <Users size={20} />
                  </div>
                  <div>
                    <div className="font-bold">Team Alpha</div>
                    <div className="text-xs text-muted-foreground">Managed by You</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm p-3 bg-muted rounded-md items-center">
                    <span>Alice (Dev)</span>
                    <span className="text-green-500 text-xs font-bold">Active</span>
                  </div>
                  <div className="flex justify-between text-sm p-3 bg-muted rounded-md items-center">
                    <span>Bob (Design)</span>
                    <span className="text-orange-500 text-xs font-bold">In Break</span>
                  </div>
                  <div className="flex justify-between text-sm p-3 bg-muted rounded-md items-center opacity-60">
                    <span>Charlie (Marketing)</span>
                    <span className="text-xs">Offline</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="w-full bg-primary/10 text-primary text-center py-2 rounded text-xs font-bold">
                      + Add New Member
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/20">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="Collabo Logo" width={150} height={48} className="h-12 w-auto opacity-80" />
          </div>
          <p className="text-muted-foreground text-sm mb-8 max-w-md mx-auto">
            The modern solution for time and project management.
            Built with Next.js, TypeScript, and Prisma.
          </p>
          <div className="text-muted-foreground text-xs">
            © {new Date().getFullYear()} Collabo. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  )
}

function CheckItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-1 text-green-600 dark:text-green-400">
        <CheckCircle2 className="h-4 w-4" />
      </div>
      <span className="text-foreground/90">{text}</span>
    </div>
  )
}
