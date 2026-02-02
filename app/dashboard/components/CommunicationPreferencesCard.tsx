'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { track } from '@/lib/analytics'
import { getUserSafe } from '@/lib/supabase/safe-auth'

type Channel = 'email' | 'phone' | 'linkedin' | 'slack' | 'other'

function placeholderFor(channel: Channel | ''): string {
  if (channel === 'phone') return '+1 (555) 123-4567'
  if (channel === 'linkedin') return 'linkedin.com/in/your-handle'
  if (channel === 'slack') return '@yourhandle or workspace'
  if (channel === 'email') return 'you@company.com'
  if (channel === 'other') return 'Handle / link'
  return 'Optional'
}

export function CommunicationPreferencesCard() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastErrorMeta, setLastErrorMeta] = useState<{
    status?: number
    code?: string
    correlationId?: string | null
  } | null>(null)

  const [preferredContactChannel, setPreferredContactChannel] = useState<Channel | ''>('')
  const [preferredContactDetail, setPreferredContactDetail] = useState<string>('')
  const [allowProductUpdates, setAllowProductUpdates] = useState<boolean>(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const user = await getUserSafe(supabase)
        if (!user) {
          if (!cancelled) setLoading(false)
          return
        }
        const { data } = await supabase
          .from('user_settings')
          .select('preferred_contact_channel, preferred_contact_detail, allow_product_updates')
          .eq('user_id', user.id)
          .maybeSingle()

        if (!cancelled) {
          const row = (data ?? null) as {
            preferred_contact_channel?: Channel | null
            preferred_contact_detail?: string | null
            allow_product_updates?: boolean | null
          } | null
          setPreferredContactChannel(row?.preferred_contact_channel ?? '')
          setPreferredContactDetail(row?.preferred_contact_detail ?? '')
          setAllowProductUpdates(row?.allow_product_updates ?? true)
        }
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          onboarding_completed: true,
          preferred_contact_channel: preferredContactChannel || undefined,
          preferred_contact_detail: preferredContactDetail.trim() || undefined,
          allow_product_updates: allowProductUpdates,
        }),
      })
      if (!res.ok) {
        const raw = await res.text().catch(() => '')
        let parsed: any = null
        try {
          parsed = raw ? JSON.parse(raw) : null
        } catch {
          parsed = null
        }

        const msg = parsed?.error || parsed?.message || 'Failed to save settings. Please try again.'

        const correlationId = res.headers.get('x-correlation-id') ?? parsed?.correlationId ?? null
        const code = parsed?.code ?? parsed?.errorCode ?? parsed?.statusCode ?? null

        setLastErrorMeta({
          status: res.status,
          code: typeof code === 'string' ? code : undefined,
          correlationId: typeof correlationId === 'string' ? correlationId : null,
        })

        const IS_DEV = process.env.NODE_ENV !== 'production'
        if (IS_DEV && raw && !parsed) {
          console.warn('[CommunicationPreferencesCard] /api/settings returned non-JSON error', { status: res.status, raw })
        }

        setError(msg)
        return
      }
      setLastErrorMeta({
        status: res.status,
        code: undefined,
        correlationId: res.headers.get('x-correlation-id'),
      })
      track('user.updated_communication_preferences', {
        channel: preferredContactChannel || null,
        allow_product_updates: allowProductUpdates,
      })
    } catch {
      setError('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const IS_DEV = process.env.NODE_ENV !== 'production'

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardContent className="py-6 space-y-4">
        <div>
          <h3 className="text-lg font-bold">Communication preferences</h3>
          <p className="text-sm text-muted-foreground">How should we reach you (if needed), and what should we send?</p>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold mb-2 block" htmlFor="comm_channel">
                  Preferred channel
                </label>
                <select
                  id="comm_channel"
                  value={preferredContactChannel}
                  onChange={(e) => setPreferredContactChannel(e.target.value as Channel | '')}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm bloomberg-font"
                >
                  <option value="">No preference</option>
                  <option value="email">email</option>
                  <option value="phone">phone</option>
                  <option value="linkedin">linkedin</option>
                  <option value="slack">slack</option>
                  <option value="other">other</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block" htmlFor="comm_detail">
                  Contact detail
                </label>
                <input
                  id="comm_detail"
                  value={preferredContactDetail}
                  onChange={(e) => setPreferredContactDetail(e.target.value)}
                  placeholder={placeholderFor(preferredContactChannel)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm bloomberg-font"
                />
              </div>
            </div>

            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={allowProductUpdates}
                onChange={(e) => setAllowProductUpdates(e.target.checked)}
                className="mt-1"
              />
              <span>Send me product updates and tips</span>
            </label>

            {error ? <div className="text-sm text-red-400">{error}</div> : null}

            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save preferences'}
              </Button>
            </div>

            {IS_DEV && lastErrorMeta ? (
              <div className="mt-3 rounded-md border border-dashed border-yellow-500/40 bg-yellow-950/40 px-3 py-1.5 text-xs font-mono text-yellow-200">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>status={lastErrorMeta.status ?? 'n/a'}</span>
                  <span>code={lastErrorMeta.code ?? 'n/a'}</span>
                  <span>correlationId={lastErrorMeta.correlationId ?? 'n/a'}</span>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

