import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

import { Providers } from "@/components/layout/Providers";

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

export const metadata: Metadata = {
  title: "Collabo - Modern Team Collaboration",
  description: "A minimalist work hours and task tracker with real-time collaboration built with Next.js, Prisma, and Neon.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Check both next-themes storage and our custom storage
                  const nextTheme = localStorage.getItem('theme');
                  const appTheme = localStorage.getItem('appTheme') || nextTheme || 'blue';
                  
                  if (appTheme === 'white') {
                    document.documentElement.classList.remove('dark');
                    document.body.classList.remove('dark');
                    document.documentElement.classList.add('white-theme');
                    document.body.classList.add('white-theme');
                    document.documentElement.classList.remove('pink-theme');
                    document.body.classList.remove('pink-theme');
                  } else if (appTheme === 'blue') {
                    document.documentElement.classList.remove('dark');
                    document.body.classList.remove('dark');
                    document.documentElement.classList.remove('white-theme');
                    document.body.classList.remove('white-theme');
                    document.documentElement.classList.remove('pink-theme');
                    document.body.classList.remove('pink-theme');
                  } else if (appTheme === 'black') {
                    document.documentElement.classList.add('dark');
                    document.body.classList.add('dark');
                    document.documentElement.classList.remove('white-theme');
                    document.body.classList.remove('white-theme');
                    document.documentElement.classList.remove('pink-theme');
                    document.body.classList.remove('pink-theme');
                  } else if (appTheme === 'pink') {
                    document.documentElement.classList.remove('dark');
                    document.body.classList.remove('dark');
                    document.documentElement.classList.remove('white-theme');
                    document.body.classList.remove('white-theme');
                    document.documentElement.classList.add('pink-theme');
                    document.body.classList.add('pink-theme');
                  } else {
                    // system or default - white when light mode, black when dark mode
                    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                    if (systemPrefersDark) {
                      // Dark mode → black theme
                      document.documentElement.classList.add('dark');
                      document.body.classList.add('dark');
                      document.documentElement.classList.remove('white-theme');
                      document.body.classList.remove('white-theme');
                    } else {
                      // Light mode → white theme
                      document.documentElement.classList.remove('dark');
                      document.body.classList.remove('dark');
                      document.documentElement.classList.add('white-theme');
                      document.body.classList.add('white-theme');
                    }
                    document.documentElement.classList.remove('pink-theme');
                    document.body.classList.remove('pink-theme');
                  }
                } catch (e) {}
              })();
            `,
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
        </Providers>
      </body>
    </html>
  );
}
