import type { WebhookEventType } from '@/lib/integrations/webhooks'

export function isSupportedWebhookDeliveryEventType(x: string | null | undefined): x is 'account.brief.generated' | 'report.generated' | 'account.pushed' {
  return x === 'account.brief.generated' || x === 'report.generated' || x === 'account.pushed'
}

export function buildWebhookDeliveryPayload(args: {
  eventType: 'account.brief.generated' | 'report.generated' | 'account.pushed'
  leadId: string | null
  meta: Record<string, unknown>
}): { eventType: WebhookEventType; payload: Record<string, unknown>; auditTarget: { targetType: 'lead' | 'report'; targetId: string | null } } {
  const reportId = typeof args.meta.reportId === 'string' && args.meta.reportId.trim().length > 0 ? args.meta.reportId.trim() : null
  const auditTarget = reportId ? { targetType: 'report' as const, targetId: reportId } : { targetType: 'lead' as const, targetId: args.leadId }
  return {
    eventType: args.eventType,
    auditTarget,
    payload: {
      kind: 'webhook_delivery',
      eventType: args.eventType,
      leadId: args.leadId,
      reportId,
      companyKey: typeof args.meta.companyKey === 'string' ? args.meta.companyKey : null,
      reportKind: typeof args.meta.reportKind === 'string' ? args.meta.reportKind : null,
      queuedAt: new Date().toISOString(),
    },
  }
}

