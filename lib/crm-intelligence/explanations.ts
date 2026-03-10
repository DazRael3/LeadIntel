import type { VerificationLabel } from '@/lib/crm-intelligence/types'

export function verificationNote(label: VerificationLabel): string {
  if (label === 'verified') return 'Verified by a workspace user as an explicit CRM link.'
  if (label === 'probable') return 'Likely linked based on available mapping and timing, but not explicitly verified.'
  if (label === 'possible') return 'Possible linkage, but verification or CRM context is incomplete.'
  if (label === 'ambiguous') return 'Multiple plausible interpretations exist; treat as ambiguous.'
  return 'Insufficient evidence to support a CRM-linked outcome.'
}

export function limitationsForNoCrm(): string {
  return 'No CRM object mapping or observation is available for this account. LeadIntel can show internal workflow outcomes, but cannot verify downstream progression without explicit CRM context.'
}

