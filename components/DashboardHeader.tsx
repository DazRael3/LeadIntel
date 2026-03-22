'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogOut, LayoutDashboard, DollarSign, ListChecks, BarChart3, Users, Package, Activity, MoreHorizontal, Settings2, Sparkles } from 'lucide-react'
import { useInAppTour } from '@/components/tour/InAppTourProvider'
import { WorkspaceSwitcher } from '@/components/navigation/WorkspaceSwitcher'
import { MobileNavMenu } from '@/components/navigation/MobileNavMenu'
import { AssistantLauncher } from '@/components/assistant/AssistantLauncher'
import { AssistantPanel } from '@/components/assistant/AssistantPanel'
import { usePlan } from '@/components/PlanProvider'
import { tierAtLeast } from '@/lib/billing/tier'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export function DashboardHeader() {
  const router = useRouter()
  const supabase = createClient()
  const { startTour } = useInAppTour()
  const [assistantOpen, setAssistantOpen] = useState(false)
  const { tier } = usePlan()
  const showTeamNav = tierAtLeast(tier, 'team')
  const showPaidNav = tier !== 'starter'
  const showMore = showPaidNav || showTeamNav

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
          <div className="flex items-center space-x-2 md:space-x-3">
            <MobileNavMenu />
            <div className="hidden md:block">
              <AssistantLauncher
                source="dashboard_header"
                onOpen={() => setAssistantOpen(true)}
                disabled={!showTeamNav}
                label={showTeamNav ? 'Assistant' : 'Assistant (Team)'}
                title={showTeamNav ? undefined : 'Upgrade to Team to use the Assistant.'}
              />
            </div>
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
              <Link href="/dashboard/actions" prefetch={false}>
                <ListChecks className="h-4 w-4 mr-2" />
                Actions
              </Link>
            </Button>
            {showTeamNav ? (
              <>
                {/* Team surfaces are intentionally grouped under "More" to reduce top-line clutter. */}
              </>
            ) : null}
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
            {showPaidNav ? (
              <Button
                asChild
                variant="ghost"
                className="hidden md:inline-flex text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
              >
                <Link href="/dashboard/history" prefetch={false} data-tour="tour-saved-outputs">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Saved outputs
                </Link>
              </Button>
            ) : null}
            {showMore ? (
              <div className="hidden md:block">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-cyan-500/10">
                      <MoreHorizontal className="h-4 w-4 mr-2" />
                      More
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Quick links</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => startTour({ source: 'in_app', location: 'dashboard_header' })}>
                      <Sparkles className="h-4 w-4" />
                      Take a tour
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings/notifications">
                        <Settings2 className="h-4 w-4" />
                        Email preferences
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {showPaidNav ? (
                      <DropdownMenuItem asChild>
                        <Link href="/learn">
                          <Activity className="h-4 w-4" />
                          Learn
                        </Link>
                      </DropdownMenuItem>
                    ) : null}
                    {showTeamNav ? (
                      <>
                        <DropdownMenuLabel>Team &amp; ops</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href="/dashboard/benchmarks">
                            <BarChart3 className="h-4 w-4" />
                            Benchmarks
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/dashboard/partner">
                            <Users className="h-4 w-4" />
                            Partner
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/dashboard/rollouts">
                            <Package className="h-4 w-4" />
                            Rollouts
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/dashboard/operations">
                            <Activity className="h-4 w-4" />
                            Operations
                          </Link>
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}
            <Button
              onClick={handleSignOut}
              variant="ghost"
              className="text-muted-foreground hover:text-foreground hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </div>

      <AssistantPanel
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        scope={{ type: 'workspace', id: null }}
        title="Assistant"
      />
    </nav>
  )
}
