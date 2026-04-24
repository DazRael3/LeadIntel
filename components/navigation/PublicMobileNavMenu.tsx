'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Menu, X, DollarSign, ShieldCheck, Sparkles, LayoutDashboard, LogIn, UserPlus, Compass, Briefcase } from 'lucide-react'

export function PublicMobileNavMenu(props: { isLoggedIn: boolean; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false)
  const titleId = 'public-mobile-menu-title'
  const describedById = 'public-mobile-menu-description'
  const dialogId = 'public-mobile-menu-dialog'
  const close = () => {
    setOpen(false)
    props.onNavigate?.()
  }

  return (
    <div className="md:hidden">
      <Button
        size="sm"
        variant="ghost"
        className="h-11 w-11 p-0 text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
        onClick={() => setOpen(true)}
        aria-label="Open site menu"
        aria-expanded={open}
        aria-controls={dialogId}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {open ? (
        <div
          id={dialogId}
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={describedById}
        >
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 top-0 p-3">
            <Card className="border-cyan-500/20 bg-background/95 backdrop-blur">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle id={titleId} className="text-base">
                      Menu
                    </CardTitle>
                    <div id={describedById} className="mt-1 text-xs text-muted-foreground">
                      Explore and get to value quickly.
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setOpen(false)} aria-label="Close menu">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <nav className="grid grid-cols-2 gap-2">
                  <MenuLink href="/pricing" label="Pricing" icon={<DollarSign className="h-4 w-4" />} onClick={close} />
                  <MenuLink href="/demo" label="Lead demo" icon={<Briefcase className="h-4 w-4" />} onClick={close} />
                  <MenuLink href="/use-cases" label="Use Cases" icon={<Briefcase className="h-4 w-4" />} onClick={close} />
                  <MenuLink href="/tour" label="Tour" icon={<Compass className="h-4 w-4" />} onClick={close} />
                  <MenuLink href="/trust" label="Trust" icon={<ShieldCheck className="h-4 w-4" />} onClick={close} />
                  <MenuLink href="/templates" label="Templates" icon={<Sparkles className="h-4 w-4" />} onClick={close} />
                  <MenuLink href="/compare" label="Compare" icon={<Sparkles className="h-4 w-4" />} onClick={close} />
                  <MenuLink href="/support" label="Support" icon={<ShieldCheck className="h-4 w-4" />} onClick={close} />

                  {props.isLoggedIn ? (
                    <>
                      <MenuLink href="/dashboard" label="Dashboard" icon={<LayoutDashboard className="h-4 w-4" />} onClick={close} prefetch={false} />
                      <MenuLink href="/competitive-report" label="Reports" icon={<Sparkles className="h-4 w-4" />} onClick={close} prefetch={false} />
                    </>
                  ) : (
                    <>
                      <MenuLink href="/login?mode=signin&redirect=/" label="Log in" icon={<LogIn className="h-4 w-4" />} onClick={close} prefetch={false} />
                      <MenuLink
                        href="/signup?redirect=/"
                        label="Sign up"
                        icon={<UserPlus className="h-4 w-4" />}
                        onClick={close}
                        prefetch={false}
                      />
                    </>
                  )}
                </nav>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MenuLink(props: { href: string; label: string; icon: React.ReactNode; onClick: () => void; prefetch?: boolean }) {
  return (
    <Link
      href={props.href}
      prefetch={props.prefetch}
      onClick={props.onClick}
      className="flex min-h-11 items-center gap-2 rounded border border-cyan-500/10 bg-background/40 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-cyan-500/10"
    >
      {props.icon}
      <span className="font-medium">{props.label}</span>
    </Link>
  )
}

