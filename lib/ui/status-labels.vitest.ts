import { describe, expect, it } from 'vitest'
import { exportJobStatusLabel, webhookDeliveryStatusLabel } from '@/lib/ui/status-labels'

describe('status labels', () => {
  it('maps export job statuses to canonical labels', () => {
    expect(exportJobStatusLabel('pending').canonical).toBe('processing')
    expect(exportJobStatusLabel('ready').canonical).toBe('ready')
    expect(exportJobStatusLabel('failed').canonical).toBe('failed')
  })

  it('maps webhook delivery statuses with attempts', () => {
    expect(webhookDeliveryStatusLabel('pending', 0).canonical).toBe('queued')
    expect(webhookDeliveryStatusLabel('pending', 2).canonical).toBe('retrying')
    expect(webhookDeliveryStatusLabel('sent', 1).canonical).toBe('delivered')
    expect(webhookDeliveryStatusLabel('failed', 6).canonical).toBe('failed')
  })
})

