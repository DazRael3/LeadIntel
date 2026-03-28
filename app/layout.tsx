import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/ThemeProvider'
import { AnalyticsBootstrap } from '@/components/AnalyticsBootstrap'

export const metadata: Metadata = {
  // Prefer configured canonical host; fall back to apex.
  metadataBase: new URL((process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? 'https://dazrael.com').trim() || 'https://dazrael.com'),
  title: 'LeadIntel - B2B Lead Intelligence Portal',
  description: 'Daily “why now” signals, deterministic scoring, and outreach templates for outbound teams.',
  openGraph: {
    title: 'LeadIntel',
    description: 'Trigger-based account alerts and instant pitch drafts.',
    url: ((process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? 'https://dazrael.com').trim() || 'https://dazrael.com'),
    images: [{ url: '/api/og?title=LeadIntel&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches', width: 1200, height: 630 }],
  },
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Use system font stack to avoid noisy dev-time Google Fonts fetches (offline/firewalled friendly). */}
      <body className="font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true} disableTransitionOnChange>
          <AnalyticsBootstrap />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
