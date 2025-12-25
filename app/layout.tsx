import type { Metadata } from "next";
import localFont from "next/font/local";
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
