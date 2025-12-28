"use client"

import { useState } from "react"
import { ArrowRight, CheckCircle2, Clock, Users, BarChart3, ShieldCheck, ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import Link from "next/link"
import { HierarchyDemo } from "@/components/landing/HierarchyDemo"
import { TimeTrackerDemo } from "@/components/landing/TimeTrackerDemo"
import { ThemeLogo } from "@/components/landing/ThemeLogo"
import { useLanguage } from "@/lib/useLanguage"

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <article className="bg-card border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow text-center">
      <div className="mb-4 flex justify-center" aria-hidden="true">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </article>
  )
}

function CheckItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-1 text-green-600 dark:text-green-400" aria-hidden="true">
        <CheckCircle2 className="h-4 w-4" />
      </div>
      <span className="text-foreground/90">{text}</span>
    </div>
  )
}

export function LandingPageContent() {
  const { t, isRTL } = useLanguage()
  const [currentSlide, setCurrentSlide] = useState(0)
  const totalSlides = 4 // 1 for hierarchy demo, 1 for time tracker, 1 for tasks, 1 for calendar

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides)
  }

  return (
    <>
      {/* Navbar / Header */}
      <header>
        <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50" role="navigation" aria-label="Main navigation">
          <div className="w-full px-6 md:px-8 h-24 flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/" aria-label="Collabo Home">
                <ThemeLogo width={140} height={56} className="h-12 w-auto" priority />
              </Link>
            </div>
            <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Link href="/login" className="text-sm font-medium hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-2 py-1">
                {t('landing.logIn')}
              </Link>
              <Link href="/register" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                {t('landing.getStarted')}
              </Link>
            </div>
          </div>
        </nav>
      </header>

      <main>

        {/* Hero Section */}
        <section className="py-20 md:py-32 overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="flex flex-col items-center text-center">
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-center">
                {t('landing.masterYourTime')}, <br className="hidden md:block" />
                <span className="text-primary">{t('landing.leadYourTeam')}</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed text-center">
                {t('landing.description')}
              </p>
              <div className={`flex flex-col sm:flex-row justify-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Link href="/register" className={`inline-flex items-center justify-center rounded-full bg-primary px-8 py-3 text-lg font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {isRTL && <ArrowRight className="h-5 w-5 rotate-180 mr-2" aria-hidden="true" />}
                  {t('landing.startYourProject')}
                  {!isRTL && <ArrowRight className="h-5 w-5 ml-2" aria-hidden="true" />}
                </Link>
                <Link href="/login" className="inline-flex items-center justify-center rounded-full border border-input bg-background px-8 py-3 text-lg font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  {t('landing.logIn')}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <FeatureCard
                icon={<Clock className="h-10 w-10 text-primary" />}
                title={t('landing.smartTimeTracking')}
                description={t('landing.smartTimeTrackingDescription')}
              />
              <FeatureCard
                icon={<Users className="h-10 w-10 text-primary" />}
                title={t('landing.projectManagement')}
                description={t('landing.projectManagementDescription')}
              />
              <FeatureCard
                icon={<BarChart3 className="h-10 w-10 text-primary" />}
                title={t('landing.detailedReports')}
                description={t('landing.detailedReportsDescription')}
              />
              <FeatureCard
                icon={<ShieldCheck className="h-10 w-10 text-primary" />}
                title={t('landing.roleBasedAccess')}
                description={t('landing.roleBasedAccessDescription')}
              />
            </div>
          </div>
        </section>

        {/* Project Management Spotlight */}
        <section className="py-24 overflow-x-hidden">
          <div className="container mx-auto px-0 md:px-4 relative">
            {/* Navigation Arrows - Outside the content, on the sides of the screen */}
            <button
              onClick={nextSlide}
              aria-label="Previous slide"
              className={`absolute top-1/2 -translate-y-1/2 z-10 transition-all hover:scale-110 ${isRTL ? 'right-full mr-4' : 'left-full ml-4'}`}
            >
              {isRTL ? <ChevronLeft className="h-12 w-12 text-foreground" /> : <ChevronRight className="h-12 w-12 text-foreground" />}
            </button>
            <button
              onClick={prevSlide}
              aria-label="Next slide"
              className={`absolute top-1/2 -translate-y-1/2 z-10 transition-all hover:scale-110 ${isRTL ? 'left-full ml-4' : 'right-full mr-4'}`}
            >
              {isRTL ? <ChevronRight className="h-12 w-12 text-foreground" /> : <ChevronLeft className="h-12 w-12 text-foreground" />}
            </button>

            <div className="relative">

              {/* Carousel Container */}
              <div className="overflow-hidden">
                <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: isRTL ? `translateX(${currentSlide * 100}%)` : `translateX(-${currentSlide * 100}%)` }}>
                  {/* Slide 1: Full Section with Text and Hierarchy */}
                  <div className="min-w-full px-6 md:px-8">
                    <div className={`grid md:grid-cols-2 gap-12 items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className={`space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary font-semibold">
                          {t('landing.forManagersLeaders')}
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold">{t('landing.takeControlOfYourTeam')}</h2>
                        <p className="text-muted-foreground text-lg leading-relaxed">
                          {t('landing.takeControlDescription')}
                        </p>
                        <ul className="space-y-4 pt-4">
                          <CheckItem text={t('landing.createCustomizedProjects')} />
                          <CheckItem text={t('landing.addUsersDirectly')} />
                          <CheckItem text={t('landing.assignTasks')} />
                          <CheckItem text={t('landing.monitorTeamHours')} />
                        </ul>
                        <div className="pt-6">
                          <Link href="/register?role=manager" className={`text-primary font-medium hover:underline inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-2 py-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            {isRTL && <ArrowRight className="h-4 w-4 rotate-180 mr-1" aria-hidden="true" />}
                            {t('landing.createManagerAccount')}
                            {!isRTL && <ArrowRight className="h-4 w-4 ml-1" aria-hidden="true" />}
                          </Link>
                        </div>
                      </div>
                      <div className="relative w-full rounded-2xl border shadow-2xl overflow-hidden bg-background mx-2" dir="ltr">
                        <div className="w-full h-full bg-background flex items-center justify-center p-8 min-h-[400px]">
                          <div className="w-full h-full flex items-center justify-center">
                            <HierarchyDemo />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Slide 2: Time Tracker Section */}
                  <div className="min-w-full px-6 md:px-8">
                    <div className={`grid md:grid-cols-2 gap-12 items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className={`space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary font-semibold">
                          {t('landing.timeTracker.title')}
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold">{t('landing.timeTracker.subtitle')}</h2>
                        <p className="text-muted-foreground text-lg leading-relaxed">
                          {t('landing.timeTracker.description')}
                        </p>
                        <ul className="space-y-4 pt-4">
                          <CheckItem text={t('landing.timeTracker.feature1')} />
                          <CheckItem text={t('landing.timeTracker.feature2')} />
                          <CheckItem text={t('landing.timeTracker.feature3')} />
                          <CheckItem text={t('landing.timeTracker.feature4')} />
                          <CheckItem text={t('landing.timeTracker.feature5')} />
                          <CheckItem text={t('landing.timeTracker.feature6')} />
                        </ul>
                      </div>
                      <div className="relative w-full rounded-2xl border shadow-2xl overflow-hidden bg-background mx-2">
                        <div className="w-full h-full bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-lg flex items-center justify-center p-8 min-h-[400px] overflow-auto">
                          <TimeTrackerDemo />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Slide 3: Tasks Section */}
                  <div className="min-w-full px-6 md:px-8">
                    <div className={`grid md:grid-cols-2 gap-12 items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className={`space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary font-semibold">
                          {t('landing.tasks.title')}
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold">{t('landing.tasks.subtitle')}</h2>
                        <p className="text-muted-foreground text-lg leading-relaxed">
                          {t('landing.tasks.description')}
                        </p>
                        <ul className="space-y-4 pt-4">
                          <CheckItem text={t('landing.tasks.feature1')} />
                          <CheckItem text={t('landing.tasks.feature2')} />
                          <CheckItem text={t('landing.tasks.feature3')} />
                          <CheckItem text={t('landing.tasks.feature4')} />
                          <CheckItem text={t('landing.tasks.feature5')} />
                          <CheckItem text={t('landing.tasks.feature6')} />
                        </ul>
                      </div>
                      <div className="relative w-full rounded-2xl border shadow-2xl overflow-visible bg-background mx-2">
                        <div className="w-full h-full bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-lg flex items-center justify-center p-8 min-h-[400px] overflow-hidden">
                          <div className="text-center space-y-4">
                            <Users className="h-24 w-24 text-primary mx-auto opacity-50" />
                            <p className="text-muted-foreground text-sm">
                              {isRTL ? 'תצוגה מקדימה של מסך ניהול המשימות' : 'Tasks Management Preview'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Slide 4: Calendar Section */}
                  <div className="min-w-full px-6 md:px-8">
                    <div className={`grid md:grid-cols-2 gap-12 items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className={`space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary font-semibold">
                          {t('landing.calendar.title')}
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold">{t('landing.calendar.subtitle')}</h2>
                        <p className="text-muted-foreground text-lg leading-relaxed">
                          {t('landing.calendar.description')}
                        </p>
                        <ul className="space-y-4 pt-4">
                          <CheckItem text={t('landing.calendar.feature1')} />
                          <CheckItem text={t('landing.calendar.feature2')} />
                          <CheckItem text={t('landing.calendar.feature3')} />
                          <CheckItem text={t('landing.calendar.feature4')} />
                          <CheckItem text={t('landing.calendar.feature5')} />
                          <CheckItem text={t('landing.calendar.feature6')} />
                        </ul>
                      </div>
                      <div className="relative w-full rounded-2xl border shadow-2xl overflow-visible bg-background mx-2">
                        <div className="w-full h-full bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-lg flex items-center justify-center p-8 min-h-[400px] overflow-hidden">
                          <div className="text-center space-y-4">
                            <Calendar className="h-24 w-24 text-primary mx-auto opacity-50" />
                            <p className="text-muted-foreground text-sm">
                              {isRTL ? 'תצוגה מקדימה של מסך היומן' : 'Calendar Preview'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Slide Indicators */}
              <div className="flex justify-center gap-2 mt-8">
                {Array.from({ length: totalSlides }).map((_, index) => (
                  <button
                    key={index}
                    className={`h-2 rounded-full transition-all ${index === currentSlide ? 'w-8 bg-primary' : 'w-2 bg-muted-foreground/50'
                      }`}
                    onClick={() => setCurrentSlide(index)}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/20" role="contentinfo">
        <div className="container mx-auto px-4">
          <div className="flex justify-center mb-4">
            <ThemeLogo width={120} height={48} className="h-10 w-auto opacity-80" />
          </div>
          <div className={`${isRTL ? 'text-right' : 'text-center'} flex flex-col items-center`}>
            <p className={`text-muted-foreground text-sm mb-8 max-w-md ${isRTL ? 'text-right' : 'text-center'}`}>
              {t('landing.footerDescription')}
            </p>
            <div className={`text-muted-foreground text-xs ${isRTL ? 'text-right' : 'text-center'}`}>
              © {new Date().getFullYear()} Collabo. {t('landing.allRightsReserved')}
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}

