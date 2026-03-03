'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

export function NotificationsSettingsClient(props: {
  initialProductTipsOptIn: boolean
  initialDigestEmailsOptIn: boolean
  initialDigestEnabled: boolean
}) {
  const { toast } = useToast()
  const [productTipsOptIn, setProductTipsOptIn] = useState(props.initialProductTipsOptIn)
  const [digestEmailsOptIn, setDigestEmailsOptIn] = useState(props.initialDigestEmailsOptIn)
  const [digestEnabled, setDigestEnabled] = useState(props.initialDigestEnabled)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          onboarding_completed: true,
          product_tips_opt_in: productTipsOptIn,
          digest_emails_opt_in: digestEmailsOptIn,
          // If user opts out of digest emails, keep digest enabled state separate.
          digest_enabled: digestEnabled,
        }),
      })
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Save failed', description: 'Please try again.' })
        return
      }
      toast({ title: 'Saved.' })
      track('settings_email_preferences_saved', { productTipsOptIn, digestEmailsOptIn, digestEnabled })
    } catch {
      toast({ variant: 'destructive', title: 'Save failed', description: 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background terminal-grid">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Email preferences</h1>
          <p className="mt-1 text-sm text-muted-foreground">Control onboarding tips and digest emails.</p>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-sm text-muted-foreground">
            <ToggleRow
              label="Product tips and onboarding emails"
              helper="Short emails that help you reach your first daily shortlist."
              checked={productTipsOptIn}
              onChange={setProductTipsOptIn}
            />
            <ToggleRow
              label="Digest emails"
              helper="Receive your daily/weekly shortlist by email."
              checked={digestEmailsOptIn}
              onChange={setDigestEmailsOptIn}
            />
            <ToggleRow
              label="Digest cadence enabled"
              helper="Controls whether LeadIntel schedules digest delivery."
              checked={digestEnabled}
              onChange={setDigestEnabled}
            />

            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={save} disabled={saving} className="neon-border hover:glow-effect">
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard">Back to dashboard</Link>
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              Digest cadence and product tips are separate toggles. You can disable emails without losing your saved setup.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ToggleRow(props: {
  label: string
  helper: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="font-medium text-foreground">{props.label}</div>
        <div className="mt-1 text-xs text-muted-foreground">{props.helper}</div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
        <span>{props.checked ? 'On' : 'Off'}</span>
      </label>
    </div>
  )
}

