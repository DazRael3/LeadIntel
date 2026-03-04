'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, ArrowLeft, X } from 'lucide-react'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { COPY } from '@/lib/copy/leadintel'
import { track } from '@/lib/analytics'

interface OnboardingWizardProps {
  onComplete: () => void
  onClose?: () => void
  initialStep?: Step
}

type Step = 1 | 2 | 3 | 4 | 5 | 6
type Cadence = 'daily' | 'weekly' | 'off'

const MAX_ACCOUNTS_IMPORT = 50

function normalizeCompanyToken(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 48)
}

function normalizeAccountInput(input: string): { raw: string; domain: string; url: string; name: string } | null {
  const raw = input.trim().replace(/[,\s]+$/g, '')
  if (!raw) return null

  // URL
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const hostname = new URL(raw).hostname.replace(/^www\./, '').toLowerCase()
      if (!hostname) return null
      return { raw, domain: hostname, url: `https://${hostname}`, name: hostname }
    }
  } catch {
    // fall through
  }

  // Domain
  const looksLikeDomain = raw.includes('.') && !raw.includes(' ')
  if (looksLikeDomain) {
    const hostname = raw.replace(/^www\./, '').toLowerCase()
    return { raw, domain: hostname, url: `https://${hostname}`, name: hostname }
  }

  // Name: make it user-friendly by assuming .com for single/multi-word names.
  const token = normalizeCompanyToken(raw)
  if (!token) return null
  const domain = `${token}.com`
  return { raw, domain, url: `https://${domain}`, name: raw }
}

function buildIdealCustomerSummary(args: {
  industry?: string
  buyerTitles: string
  companySize?: string
  regions?: string
  notes?: string
}): string {
  const lines: string[] = []
  if (args.industry?.trim()) lines.push(`Industry: ${args.industry.trim()}`)
  lines.push(`Buyer titles: ${args.buyerTitles.trim()}`)
  if (args.companySize?.trim()) lines.push(`Company size: ${args.companySize.trim()}`)
  if (args.regions?.trim()) lines.push(`Regions: ${args.regions.trim()}`)
  if (args.notes?.trim()) lines.push(`Notes: ${args.notes.trim()}`)
  return lines.join('\n')
}

export function OnboardingWizard({ onComplete, onClose, initialStep }: OnboardingWizardProps) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const { toast } = useToast()

  const [step, setStep] = useState<Step>(initialStep ?? 1)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // Screen 2: ICP
  const [industry, setIndustry] = useState('')
  const [buyerTitles, setBuyerTitles] = useState('')
  const [companySize, setCompanySize] = useState('')
  const [regions, setRegions] = useState('')
  const [notes, setNotes] = useState('')

  // Screen 3: Accounts
  const [accountsText, setAccountsText] = useState('')
  const [accountsAdded, setAccountsAdded] = useState<string[]>([])

  // Screen 4: Cadence
  const [cadence, setCadence] = useState<Cadence>('daily')

  // Screen 5: First pitch
  const [pitchAccount, setPitchAccount] = useState<string>('')

  useEffect(() => {
    void (async () => {
      const user = await getUserSafe(supabase)
      if (user) setUserId(user.id)
    })()
  }, [supabase])

  async function saveSettings(payload: Record<string, unknown>): Promise<void> {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('settings_save_failed')
  }

  async function handleSkip() {
    setLoading(true)
    try {
      await saveSettings({ onboarding_completed: true })
      onComplete()
    } catch {
      toast({ variant: 'destructive', title: COPY.errors.requestFailed.title, description: COPY.errors.requestFailed.body })
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveIcp() {
    if (!buyerTitles.trim()) {
      toast({
        variant: 'destructive',
        title: COPY.validation.required,
        description: COPY.onboarding.screen2.buyerTitlesMissing,
      })
      return
    }
    setLoading(true)
    try {
      const ideal_customer = buildIdealCustomerSummary({ industry, buyerTitles, companySize, regions, notes })
      await saveSettings({ ideal_customer, onboarding_completed: false })
      track('created_icp', { buyerTitlesProvided: true })
      setStep(3)
    } catch {
      toast({ variant: 'destructive', title: COPY.errors.requestFailed.title, description: COPY.errors.requestFailed.body })
    } finally {
      setLoading(false)
    }
  }

  async function handleAddAccounts() {
    const tokens = accountsText
      .split('\n')
      .flatMap((line) => line.split(','))
      .map((l) => l.trim())
      .filter(Boolean)
    const unique = Array.from(new Set(tokens))

    if (unique.length === 0) {
      toast({ variant: 'destructive', title: COPY.validation.required, description: COPY.onboarding.screen3.emptyHelper })
      return
    }
    if (unique.length > MAX_ACCOUNTS_IMPORT) {
      toast({
        variant: 'destructive',
        title: COPY.validation.invalidCompanyOrUrl,
        description: COPY.onboarding.screen3.tooMany(MAX_ACCOUNTS_IMPORT),
      })
      return
    }
    if (!userId) {
      toast({ variant: 'destructive', title: COPY.errors.sessionExpired.title, description: COPY.errors.sessionExpired.body })
      router.push('/login?mode=signin&redirect=/dashboard')
      return
    }

    setLoading(true)
    try {
      const parsed = unique.map((raw) => normalizeAccountInput(raw)).filter(Boolean) as Array<{
        raw: string
        domain: string
        url: string
        name: string
      }>
      if (parsed.length === 0) {
        toast({ variant: 'destructive', title: COPY.validation.required, description: COPY.onboarding.screen3.emptyHelper })
        return
      }

      const rows = parsed.map((p) => {
        return {
          user_id: userId,
          company_url: p.url,
          company_domain: p.domain,
          company_name: p.name,
          ai_personalized_pitch: null,
        }
      })

      const { error } = await supabase.from('leads').upsert(rows, { onConflict: 'user_id,company_domain' })
      if (error) throw error

      setAccountsAdded(unique)
      setPitchAccount(unique[0] || '')
      setStep(4)
    } catch {
      toast({ variant: 'destructive', title: COPY.errors.requestFailed.title, description: COPY.errors.requestFailed.body })
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveCadence() {
    setLoading(true)
    try {
      if (cadence === 'off') {
        await saveSettings({ digest_enabled: false, onboarding_completed: false })
      } else {
        await saveSettings({ digest_enabled: true, digest_dow: 1, digest_hour: 9, onboarding_completed: false })
      }
      setStep(5)
    } catch {
      toast({ variant: 'destructive', title: COPY.errors.requestFailed.title, description: COPY.errors.requestFailed.body })
    } finally {
      setLoading(false)
    }
  }

  async function handleDone() {
    setLoading(true)
    try {
      await saveSettings({ onboarding_completed: true })
      track('onboarding_completed', { cadence })
      onComplete()
    } catch {
      toast({ variant: 'destructive', title: COPY.errors.requestFailed.title, description: COPY.errors.requestFailed.body })
    } finally {
      setLoading(false)
    }
  }

  const canGoBack = step > 1 && step < 6

  return (
    <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-screen flex items-start justify-center p-4 pt-10">
        <Card className="w-full max-w-3xl border-cyan-500/20 bg-card/70">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl bloomberg-font neon-cyan">
                  {step === 1
                    ? COPY.onboarding.screen1.title
                    : step === 2
                      ? COPY.onboarding.screen2.title
                      : step === 3
                        ? COPY.onboarding.screen3.title
                        : step === 4
                          ? COPY.onboarding.screen4.title
                          : step === 5
                            ? COPY.onboarding.screen5.title
                            : COPY.onboarding.screen6.title}
                </CardTitle>
                {step === 1 ? <div className="mt-2 text-sm text-muted-foreground">{COPY.onboarding.screen1.subhead}</div> : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onClose?.()}
                aria-label="Close onboarding"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {step === 1 ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">{COPY.positioning.icpLine}</div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button className="neon-border hover:glow-effect" disabled={loading} onClick={() => setStep(2)}>
                    {COPY.onboarding.screen1.primary}
                  </Button>
                  <Button variant="outline" disabled={loading} onClick={handleSkip}>
                    {COPY.onboarding.screen1.secondary}
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">{COPY.onboarding.screen2.helper}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="icp_industry">Industry (optional)</Label>
                    <Input
                      id="icp_industry"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder={COPY.onboarding.screen2.fields.industry}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="icp_company_size">Company size (optional)</Label>
                    <Input
                      id="icp_company_size"
                      value={companySize}
                      onChange={(e) => setCompanySize(e.target.value)}
                      placeholder={COPY.onboarding.screen2.fields.companySize}
                      className="bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="icp_buyer_titles">Buyer titles (required)</Label>
                  <Input
                    id="icp_buyer_titles"
                    value={buyerTitles}
                    onChange={(e) => setBuyerTitles(e.target.value)}
                    placeholder={COPY.onboarding.screen2.fields.buyerTitles}
                    className="bg-background"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="icp_regions">Regions (optional)</Label>
                    <Input
                      id="icp_regions"
                      value={regions}
                      onChange={(e) => setRegions(e.target.value)}
                      placeholder={COPY.onboarding.screen2.fields.regions}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="icp_notes">Notes (optional)</Label>
                    <Input
                      id="icp_notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={COPY.onboarding.screen2.fields.notes}
                      className="bg-background"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button className="neon-border hover:glow-effect" disabled={loading} onClick={handleSaveIcp}>
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    {COPY.onboarding.screen2.primary}
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">{COPY.onboarding.screen3.helper}</div>
                <div className="space-y-2">
                  <Label htmlFor="accounts_text">{COPY.onboarding.screen3.fieldLabel}</Label>
                  <Textarea
                    id="accounts_text"
                    value={accountsText}
                    onChange={(e) => setAccountsText(e.target.value)}
                    placeholder="acme.com\nnorthwind.com\nContoso"
                    className="min-h-[160px] bg-background"
                  />
                  <div className="text-xs text-muted-foreground">{COPY.onboarding.screen3.emptyHelper}</div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button className="neon-border hover:glow-effect" disabled={loading} onClick={handleAddAccounts}>
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    {COPY.onboarding.screen3.primary}
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">{COPY.onboarding.screen4.helper}</div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="radio" name="cadence" checked={cadence === 'daily'} onChange={() => setCadence('daily')} />
                    <span>{COPY.onboarding.screen4.options.daily}</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="radio" name="cadence" checked={cadence === 'weekly'} onChange={() => setCadence('weekly')} />
                    <span>{COPY.onboarding.screen4.options.weekly}</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="radio" name="cadence" checked={cadence === 'off'} onChange={() => setCadence('off')} />
                    <span>{COPY.onboarding.screen4.options.off}</span>
                  </label>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button className="neon-border hover:glow-effect" disabled={loading} onClick={handleSaveCadence}>
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    {COPY.onboarding.screen4.primary}
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 5 ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">{COPY.onboarding.screen5.helper}</div>
                <div className="space-y-2">
                  <Label htmlFor="pitch_account">Account</Label>
                  <Input
                    id="pitch_account"
                    value={pitchAccount}
                    onChange={(e) => setPitchAccount(e.target.value)}
                    placeholder={accountsAdded[0] ? accountsAdded[0] : 'acme.com'}
                    className="bg-background"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    className="neon-border hover:glow-effect"
                    disabled={loading}
                    onClick={() => {
                      const v = pitchAccount.trim()
                      if (!v) return
                      track('pitch_generate_clicked', { source: 'onboarding' })
                      router.push(`/pitch?url=${encodeURIComponent(v)}`)
                    }}
                  >
                    {COPY.onboarding.screen5.primary}
                  </Button>
                  <Button variant="outline" disabled={loading} onClick={() => setStep(6)}>
                    {COPY.onboarding.screen5.secondary}
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 6 ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">{COPY.onboarding.screen6.subhead}</div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button className="neon-border hover:glow-effect" disabled={loading} onClick={handleDone}>
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    {COPY.onboarding.screen6.primary}
                  </Button>
                  <Button variant="outline" disabled={loading} onClick={() => router.push('/pricing')}>
                    {COPY.onboarding.screen6.secondary}
                  </Button>
                </div>
              </div>
            ) : null}

            {step !== 1 && step !== 6 ? (
              <div className="flex items-center justify-between pt-2 border-t border-cyan-500/10">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!canGoBack || loading}
                  onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div className="text-xs text-muted-foreground">Step {step} of 6</div>
                <div className="w-[84px]" />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

