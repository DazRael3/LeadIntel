'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogOut, LayoutDashboard, DollarSign, ListChecks, BarChart3, Users, Package, Activity } from 'lucide-react'
import { useInAppTour } from '@/components/tour/InAppTourProvider'
import { WorkspaceSwitcher } from '@/components/navigation/WorkspaceSwitcher'

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
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center space-x-2 group">
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent group-hover:from-cyan-300 group-hover:to-purple-300 transition-colors">
                LeadIntel
              </span>
            </Link>
            <div className="hidden md:block">
              <WorkspaceSwitcher />
            </div>
          </div>

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
              className="hidden md:inline-flex text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
            >
              <Link href="/dashboard/benchmarks">
                <BarChart3 className="h-4 w-4 mr-2" />
                Benchmarks
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="hidden md:inline-flex text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
            >
              <Link href="/dashboard/partner">
                <Users className="h-4 w-4 mr-2" />
                Partner
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="hidden md:inline-flex text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
            >
              <Link href="/dashboard/rollouts">
                <Package className="h-4 w-4 mr-2" />
                Rollouts
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="hidden md:inline-flex text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
            >
              <Link href="/dashboard/operations">
                <Activity className="h-4 w-4 mr-2" />
                Operations
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
