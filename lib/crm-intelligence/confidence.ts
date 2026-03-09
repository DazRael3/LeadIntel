import type { CrmMappingVerificationStatus, VerificationLabel } from '@/lib/crm-intelligence/types'

export function verificationFromMappingStatus(status: CrmMappingVerificationStatus): VerificationLabel {
  if (status === 'verified') return 'verified'
  if (status === 'unverified') return 'possible'
  if (status === 'needs_review') return 'possible'
  if (status === 'ambiguous') return 'ambiguous'
  if (status === 'not_linked') return 'insufficient_evidence'
  return 'possible'
}

