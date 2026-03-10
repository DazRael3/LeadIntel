import { describe, expect, test } from 'vitest'
import { defaultWorkspacePolicies, inviteDomainForEmail, isInviteAllowed, mergeWorkspacePolicies } from '@/lib/domain/workspace-policies'

describe('workspace-policies', () => {
  test('inviteDomainForEmail extracts normalized domain', () => {
    expect(inviteDomainForEmail('A@Example.COM')).toBe('example.com')
    expect(inviteDomainForEmail('bad')).toBe(null)
  })

  test('isInviteAllowed allows when no restriction', () => {
    const policies = defaultWorkspacePolicies()
    expect(isInviteAllowed({ policies, email: 'x@anything.com' })).toBe(true)
  })

  test('isInviteAllowed blocks disallowed domains', () => {
    const policies = mergeWorkspacePolicies({
      current: defaultWorkspacePolicies(),
      patch: { invite: { allowedDomains: ['acme.com'] } },
    })
    expect(isInviteAllowed({ policies, email: 'x@acme.com' })).toBe(true)
    expect(isInviteAllowed({ policies, email: 'x@other.com' })).toBe(false)
  })
})

