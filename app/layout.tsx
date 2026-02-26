import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/ThemeProvider"
import { Analytics } from "@vercel/analytics/next"

export const metadata: Metadata = {
  title: "LeadIntel - B2B Lead Intelligence Portal",
  description: "Advanced B2B lead intelligence and personalized pitch generation",
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
          {children}
          <Toaster />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
