import type { Metadata } from "next";
import localFont from "next/font/local";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

import { Providers } from "@/components/layout/Providers";
import { CookieConsentBanner } from "@/components/layout/CookieConsentBanner";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "Collabo | Master Your Time, Lead Your Team",
  description: "The all-in-one workspace for every team. Seamlessly track hours, manage complex projects, and lead your organization with clarity. A professional solution tailored for freelancers, startups, and established enterprises.",
  metadataBase: new URL('https://collabo-web.com'),
  manifest: "/manifest.json",
  themeColor: "#ffffff",
  appleWebApp: {
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/collabologocut.png", media: "(prefers-color-scheme: light)", type: "image/png", sizes: "32x32" },
      { url: "/collabologocutwhite.png", media: "(prefers-color-scheme: dark)", type: "image/png", sizes: "32x32" },
    ],
    shortcut: [
      { url: "/collabologocut.png", media: "(prefers-color-scheme: light)", type: "image/png" },
      { url: "/collabologocutwhite.png", media: "(prefers-color-scheme: dark)", type: "image/png" },
    ],
    apple: [
      { url: "/collabologocut.png", media: "(prefers-color-scheme: light)", type: "image/png", sizes: "180x180" },
      { url: "/collabologocutwhite.png", media: "(prefers-color-scheme: dark)", type: "image/png", sizes: "180x180" },
    ],
    other: [
      {
        rel: "apple-touch-icon",
        url: "/collabospecialnoback.png",
      },
    ],
  },
  openGraph: {
    title: "Collabo | Master Your Time, Lead Your Team",
    description: "The all-in-one workspace for every team. Seamlessly track hours, manage complex projects, and lead your organization with clarity. A professional solution tailored for freelancers, startups, and established enterprises.",
    url: "https://collabo-web.com",
    siteName: "Collabo",
    images: [
      {
        url: "/collabologo.png",
        width: 1200,
        height: 630,
        alt: "Collabo Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Collabo | Master Your Time, Lead Your Team",
    description: "The all-in-one workspace for every team. Seamlessly track hours, manage complex projects, and lead your organization with clarity. A professional solution tailored for freelancers, startups, and established enterprises.",
    images: ["/collabologo.png"],
  },
  verification: {
    google: "pD0VM3NjqBMRzZegnSIGRHan7ruRQ0SzdQfrzRgSjmU",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} antialiased`}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const nextTheme = localStorage.getItem('theme');
                const appTheme = localStorage.getItem('appTheme') || nextTheme || 'blue';
                
                if (appTheme === 'white') {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('white-theme');
                  document.documentElement.classList.remove('pink-theme');
                } else if (appTheme === 'blue') {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.remove('white-theme');
                  document.documentElement.classList.remove('pink-theme');
                } else if (appTheme === 'black') {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('white-theme');
                  document.documentElement.classList.remove('pink-theme');
                } else if (appTheme === 'pink') {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.remove('white-theme');
                  document.documentElement.classList.add('pink-theme');
                } else {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('white-theme');
                  document.documentElement.classList.remove('pink-theme');
                }
                
                // Set language and direction
                const savedLanguage = localStorage.getItem('language') || 'en';
                const isRTL = savedLanguage === 'he';
                document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
                document.documentElement.setAttribute('lang', savedLanguage);
              } catch (e) {}
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Collabo",
              "url": "https://collabo-web.com",
              "logo": "https://collabo-web.com/collabologocut.png",
              "description": "The all-in-one workspace for every team. Seamlessly track hours, manage complex projects, and lead your organization with clarity. A professional solution tailored for freelancers, startups, and established enterprises."
            })
          }}
        />
        <Providers>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Skip to main content
          </a>
          {children}
          <Toaster />
          <CookieConsentBanner />
        </Providers>
      </body>
    </html>
  );
}
