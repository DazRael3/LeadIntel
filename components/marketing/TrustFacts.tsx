'use client'

import type { ComponentType } from 'react'
import { useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Shield, Lock, Activity, CreditCard, ScrollText } from 'lucide-react'
import { track } from '@/lib/analytics'

type TrustFact = {
  key: 'tenant_isolation' | 'security_headers' | 'rate_limiting' | 'structured_logging' | 'stripe_billing'
  label: string
  detail: string
  icon: ComponentType<{ className?: string }>
}

const FACTS: TrustFact[] = [
  {
    key: 'tenant_isolation',
    label: 'Tenant isolation',
    detail: 'User data is access-controlled and scoped by authenticated identity.',
    icon: Lock,
  },
  {
    key: 'security_headers',
    label: 'Security headers',
    detail: 'Conservative headers and CSP are applied to reduce common browser attack classes.',
    icon: Shield,
  },
  {
    key: 'rate_limiting',
    label: 'Rate limiting',
    detail: 'Public endpoints and automation surfaces are rate-limited (with safe fallback).',
    icon: Activity,
  },
  {
    key: 'structured_logging',
    label: 'Structured logging',
    detail: 'Operational errors are logged with safe, structured context—without secrets.',
    icon: ScrollText,
  },
  {
    key: 'stripe_billing',
    label: 'Stripe billing',
    detail: 'Checkout and billing portal are handled via Stripe for safety and reliability.',
    icon: CreditCard,
  },
]

export function TrustFacts() {
  const ref = useRef<HTMLDivElement | null>(null)
  const fired = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (fired.current) return

    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        if (fired.current) return
        fired.current = true
        track('marketing_trust_facts_viewed', { facts: FACTS.map((f) => f.key) })
      },
      { threshold: 0.35 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} className="rounded-xl border border-cyan-500/20 bg-card/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-foreground">Trust facts</div>
        <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
          Production-grade defaults
        </Badge>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        {FACTS.map((f) => {
          const Icon = f.icon
          return (
            <div key={f.key} className="rounded-lg border border-cyan-500/10 bg-background/40 px-3 py-3">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-cyan-400" />
                <div className="text-xs font-semibold text-foreground">{f.label}</div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{f.detail}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

