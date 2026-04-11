'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, Loader2 } from 'lucide-react'
import { track } from '@/lib/analytics'

type Intent = 'demo' | 'pricing_question' | 'trial_help' | 'general'
type DeviceClass = 'mobile' | 'desktop' | 'unknown'

function getDeviceClass(): DeviceClass {
  if (typeof window === 'undefined') return 'unknown'
  const w = window.innerWidth
  if (!Number.isFinite(w)) return 'unknown'
  return w < 768 ? 'mobile' : 'desktop'
}

function getViewport(): { w?: number; h?: number } {
  if (typeof window === 'undefined') return {}
  const w = Math.max(0, Math.floor(window.innerWidth || 0))
  const h = Math.max(0, Math.floor(window.innerHeight || 0))
  return { w, h }
}

function safeText(v: unknown, max = 2000): string {
  if (typeof v !== 'string') return ''
  const s = v.trim()
  return s.length > max ? s.slice(0, max) : s
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function parseUtm(): { source?: string; medium?: string; campaign?: string } {
  if (typeof window === 'undefined') return {}
  try {
    const qs = new URLSearchParams(window.location.search)
    const source = safeText(qs.get('utm_source'))
    const medium = safeText(qs.get('utm_medium'))
    const campaign = safeText(qs.get('utm_campaign'))
    return {
      ...(source ? { source } : {}),
      ...(medium ? { medium } : {}),
      ...(campaign ? { campaign } : {}),
    }
  } catch {
    return {}
  }
}

export function LeadCaptureCard(props: {
  surface: string
  intent?: Intent
  title?: string
  subtitle?: string
  ctaLabel?: string
  className?: string
}) {
  const pathname = usePathname()
  const route = useMemo(() => (typeof pathname === 'string' && pathname.trim() ? pathname : '/'), [pathname])

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [message, setMessage] = useState('')
  const [consentMarketing, setConsentMarketing] = useState(false)

  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  const intent = props.intent ?? 'demo'
  const title = props.title ?? 'Request a demo'
  const subtitle = props.subtitle ?? 'Tell us what you’re evaluating and we’ll reply quickly.'
  const ctaLabel = props.ctaLabel ?? 'Send request'

  const emailValid = isValidEmail(email)
  const canSend = emailValid && consentMarketing && status !== 'sending'

  const send = async () => {
    if (!canSend) return
    setStatus('sending')
    setError(null)
    track('lead_capture_opened', { surface: props.surface, route, intent, deviceClass: getDeviceClass() })
    try {
      const viewport = getViewport()
      const utm = parseUtm()
      const referrer = typeof document !== 'undefined' ? safeText(document.referrer, 512) : ''
      const res = await fetch('/api/lead-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          company: company.trim() || undefined,
          role: role.trim() || undefined,
          intent,
          formType: intent,
          message: message.trim() || undefined,
          route,
          sourcePage: route,
          consentMarketing,
          referrer: referrer || undefined,
          utm: Object.keys(utm).length > 0 ? utm : undefined,
          deviceClass: getDeviceClass(),
          viewport,
        }),
        keepalive: true,
      })
      if (!res.ok) {
        setError('Could not submit. Please try again, or email us from the Support page.')
        setStatus('idle')
        track('lead_capture_failed', { surface: props.surface, route, intent, status: res.status })
        if (intent === 'demo') {
          track('demo_request_failed', { surface: props.surface, route, status: res.status })
        }
        return
      }
      setStatus('sent')
      setMessage('')
      track('lead_capture_submitted', { surface: props.surface, route, intent })
      if (intent === 'demo') {
        track('demo_request_submitted', { surface: props.surface, route, formType: intent })
      }
    } catch {
      setError('Could not submit. Please try again, or email us from the Support page.')
      setStatus('idle')
      track('lead_capture_failed', { surface: props.surface, route, intent, status: 'exception' })
      if (intent === 'demo') {
        track('demo_request_failed', { surface: props.surface, route, status: 'exception' })
      }
    }
  }

  return (
    <Card className={props.className ?? 'border-cyan-500/20 bg-card/60'}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
        <div className="text-sm text-muted-foreground">{subtitle}</div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <div>{error}</div>
            </div>
          </div>
        ) : null}

        {status === 'sent' ? (
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-muted-foreground space-y-3">
            <div className="font-medium text-foreground">Request received</div>
            <div className="mt-1">We’ll reply to <span className="text-foreground font-medium">{email.trim()}</span>.</div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/pricing">Review pricing</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/#try-sample">Generate sample digest</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/support#email-preferences">Email preferences</Link>
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`lead-name-${props.surface}`}>Name (optional)</Label>
            <Input
              id={`lead-name-${props.surface}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`lead-email-${props.surface}`}>Email</Label>
            <Input
              id={`lead-email-${props.surface}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              inputMode="email"
              autoComplete="email"
            />
            {email.trim().length > 0 && !emailValid ? (
              <div className="text-xs text-red-300">Enter a valid email address.</div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`lead-company-${props.surface}`}>Company (optional)</Label>
            <Input
              id={`lead-company-${props.surface}`}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Acme"
              autoComplete="organization"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`lead-role-${props.surface}`}>Role (optional)</Label>
            <Input
              id={`lead-role-${props.surface}`}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Founder, RevOps, SDR Manager"
              autoComplete="organization-title"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`lead-message-${props.surface}`}>Message (optional)</Label>
            <Textarea
              id={`lead-message-${props.surface}`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What are you trying to do? (No passwords or API keys)"
              className="min-h-[96px]"
            />
          </div>
        </div>

        <div className="rounded border border-cyan-500/10 bg-background/40 p-3 space-y-2">
          <label htmlFor={`lead-consent-${props.surface}`} className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              id={`lead-consent-${props.surface}`}
              type="checkbox"
              checked={consentMarketing}
              onChange={(e) => setConsentMarketing(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-cyan-400"
            />
            <span>
              I agree to be contacted about this request and product updates. I can opt out at any time.
            </span>
          </label>
          <div className="text-xs text-muted-foreground">
            By submitting, you agree to our{' '}
            <Link className="text-cyan-300 hover:underline" href="/privacy">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link className="text-cyan-300 hover:underline" href="/terms">
              Terms
            </Link>
            .
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">We only store what you submit and track attribution for follow-up.</div>
          <Button
            type="button"
            className="min-h-11 px-5 neon-border hover:glow-effect"
            disabled={!canSend}
            onClick={() => void send()}
          >
            {status === 'sending' ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending…
              </>
            ) : (
              ctaLabel
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

