'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogOut, LayoutDashboard, DollarSign, ListChecks } from 'lucide-react'
import { useInAppTour } from '@/components/tour/InAppTourProvider'

export function DashboardHeader() {
  const router = useRouter()
  const supabase = createClient()
  const { startTour } = useInAppTour()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="border-b border-cyan-500/20 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo */}
          <Link 
            href="/" 
            className="flex items-center space-x-2 group"
          >
            <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent group-hover:from-cyan-300 group-hover:to-purple-300 transition-colors">
              LeadIntel
            </span>
          </Link>

          {/* Right: Navigation Links */}
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => startTour({ source: 'in_app', location: 'dashboard_header' })}
              variant="ghost"
              className="text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
            >
              Take a tour
            </Button>
            <Button
              asChild
              variant="ghost"
              className="hidden md:inline-flex text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
            >
              <Link href="/settings/notifications">Email preferences</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
            >
              <Link href="/dashboard">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="hidden md:inline-flex text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
            >
              <Link href="/dashboard/actions">
                <ListChecks className="h-4 w-4 mr-2" />
                Actions
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
            >
              <Link href="/pricing">
                <DollarSign className="h-4 w-4 mr-2" />
                Pricing
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
            >
              <Link href="/dashboard/history" data-tour="tour-saved-outputs">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Pitch History
              </Link>
            </Button>
            <Button
              onClick={handleSignOut}
              variant="ghost"
              className="text-muted-foreground hover:text-foreground hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
