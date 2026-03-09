'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Menu, X, LayoutDashboard, ListChecks, BarChart3, Users, Package, Activity, Settings2, ShieldCheck, FlaskConical, CheckSquare } from 'lucide-react'
import { WorkspaceSwitcher } from '@/components/navigation/WorkspaceSwitcher'

export function MobileNavMenu() {
  const [open, setOpen] = useState(false)

  return (
    <div className="md:hidden">
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 top-0 p-3">
            <Card className="border-cyan-500/20 bg-background/95 backdrop-blur">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Menu</CardTitle>
                    <div className="mt-1 text-xs text-muted-foreground">Workspace context and key surfaces.</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setOpen(false)} aria-label="Close menu">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded border border-cyan-500/10 bg-card/30 p-3">
                  <div className="text-xs text-muted-foreground">Workspace</div>
                  <div className="mt-2">
                    <WorkspaceSwitcher showPicker />
                  </div>
                </div>

                <nav className="grid grid-cols-2 gap-2">
                  <MenuLink href="/dashboard" label="Dashboard" icon={<LayoutDashboard className="h-4 w-4" />} onClick={() => setOpen(false)} />
                  <MenuLink href="/dashboard/actions" label="Actions" icon={<ListChecks className="h-4 w-4" />} onClick={() => setOpen(false)} />
                  <MenuLink href="/dashboard/approvals" label="Approvals" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => setOpen(false)} />
                  <MenuLink href="/dashboard/benchmarks" label="Benchmarks" icon={<BarChart3 className="h-4 w-4" />} onClick={() => setOpen(false)} />
                  <MenuLink href="/dashboard/growth" label="Growth" icon={<FlaskConical className="h-4 w-4" />} onClick={() => setOpen(false)} />
                  <MenuLink href="/dashboard/verification" label="Verify" icon={<CheckSquare className="h-4 w-4" />} onClick={() => setOpen(false)} />
                  <MenuLink href="/dashboard/revenue-workflows" label="Revenue" icon={<BarChart3 className="h-4 w-4" />} onClick={() => setOpen(false)} />
                  <MenuLink href="/dashboard/partner" label="Partner" icon={<Users className="h-4 w-4" />} onClick={() => setOpen(false)} />
                  <MenuLink href="/dashboard/rollouts" label="Rollouts" icon={<Package className="h-4 w-4" />} onClick={() => setOpen(false)} />
                  <MenuLink href="/dashboard/operations" label="Ops" icon={<Activity className="h-4 w-4" />} onClick={() => setOpen(false)} />
                  <MenuLink href="/settings/platform" label="Platform" icon={<Settings2 className="h-4 w-4" />} onClick={() => setOpen(false)} />
                  <MenuLink href="/settings/revenue-intelligence" label="Revenue" icon={<ShieldCheck className="h-4 w-4" />} onClick={() => setOpen(false)} />
                  <MenuLink href="/settings/experiments" label="Experiments" icon={<FlaskConical className="h-4 w-4" />} onClick={() => setOpen(false)} />
                  <MenuLink href="/settings/notifications" label="Prefs" icon={<Settings2 className="h-4 w-4" />} onClick={() => setOpen(false)} />
                </nav>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MenuLink(props: { href: string; label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <Link
      href={props.href}
      onClick={props.onClick}
      className="flex items-center gap-2 rounded border border-cyan-500/10 bg-background/40 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
    >
      {props.icon}
      <span className="font-medium">{props.label}</span>
    </Link>
  )
}

