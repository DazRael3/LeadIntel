import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

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
    <html lang="en" className="dark">
      {/* Use system font stack to avoid noisy dev-time Google Fonts fetches (offline/firewalled friendly). */}
      <body className="font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
