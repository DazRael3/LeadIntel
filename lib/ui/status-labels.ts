import type { CanonicalStatus, StatusTone } from '@/lib/domain/status'

export type StatusLabel = { label: string; tone: StatusTone; canonical: CanonicalStatus }

export function exportJobStatusLabel(status: 'pending' | 'ready' | 'failed'): StatusLabel {
  if (status === 'ready') return { label: 'Ready', tone: 'good', canonical: 'ready' }
  if (status === 'failed') return { label: 'Failed', tone: 'bad', canonical: 'failed' }
  return { label: 'Processing', tone: 'warn', canonical: 'processing' }
}

export function webhookDeliveryStatusLabel(status: 'pending' | 'sent' | 'failed', attempts: number): StatusLabel {
  if (status === 'sent') return { label: 'Delivered', tone: 'good', canonical: 'delivered' }
  if (status === 'failed') return { label: 'Failed', tone: 'bad', canonical: 'failed' }
  if (attempts > 0) return { label: 'Retrying', tone: 'warn', canonical: 'retrying' }
  return { label: 'Queued', tone: 'neutral', canonical: 'queued' }
}

export function badgeClassForTone(tone: StatusTone): string {
  if (tone === 'good') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  if (tone === 'warn') return 'border-amber-500/30 bg-amber-500/10 text-amber-200'
  if (tone === 'bad') return 'border-red-500/30 bg-red-500/10 text-red-200'
  return 'border-cyan-500/20 bg-background/40 text-muted-foreground'
}

