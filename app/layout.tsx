import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/ThemeProvider'
import { AnalyticsBootstrap } from '@/components/AnalyticsBootstrap'
import { Suspense } from 'react'
import { ReportGenerationManager } from '@/components/report/ReportGenerationManager'

export const metadata: Metadata = {
  // Prefer configured canonical host; fall back to apex.
  metadataBase: new URL((process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? 'https://raelinfo.com').trim() || 'https://raelinfo.com'),
  title: 'LeadIntel - B2B Lead Intelligence Portal',
  description: 'Daily “why now” signals, deterministic scoring, and outreach templates for outbound teams.',
  openGraph: {
    title: 'LeadIntel',
<<<<<<< HEAD
<<<<<<< HEAD
    description: 'Trigger-based account alerts and instant pitch drafts.',
=======
    description: 'Trigger-based account alerts and send-ready outreach drafts.',
>>>>>>> cursor/audit-access-instructions-aa8d
=======
    description: 'Trigger-based account alerts and send-ready outreach drafts.',
>>>>>>> cursor/audit-access-instructions-aa8d
    url: ((process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? 'https://raelinfo.com').trim() || 'https://raelinfo.com'),
    // Use a reliable fallback image for metadata. Dynamic OG rendering can fail in production runtimes;
    // keep it available at /api/og but don't make it a hard dependency for social previews.
    images: [{ url: '/api/og-fallback', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LeadIntel',
    description: 'Trigger-based account alerts and send-ready outreach drafts.',
    images: ['/api/og-fallback'],
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
          <Suspense fallback={null}>
            <ReportGenerationManager />
          </Suspense>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
