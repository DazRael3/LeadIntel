import { verifyEmbedToken } from '@/lib/embed/security'
import { getEmbedAccountSummary } from '@/lib/embed/engine'
import { EmbedErrorState } from '@/components/embed/EmbedErrorState'
import { EmbedFrame } from '@/components/embed/EmbedFrame'
import { AccountSummaryWidget } from '@/components/embed/AccountSummaryWidget'

export const dynamic = 'force-dynamic'

export default async function EmbedAccountSummaryPage(props: { searchParams: Promise<{ token?: string; accountId?: string }> }) {
  const sp = await props.searchParams
  const token = (sp.token ?? '').trim()
  const accountId = (sp.accountId ?? '').trim()
  const payload = token ? verifyEmbedToken(token) : null
  if (!payload || payload.kind !== 'account_summary') return <EmbedErrorState title="Embed invalid" detail="Token is invalid or expired." />
  const id = payload.accountId ?? accountId
  if (!id) return <EmbedErrorState title="Embed invalid" detail="Missing account id." />

  const data = await getEmbedAccountSummary({ workspaceId: payload.workspaceId, accountId: id })
  if (!data) return <EmbedErrorState title="Not found" detail="Account not found." />

  return (
    <EmbedFrame title="Account summary" subtitle="Embed-safe widget">
      <AccountSummaryWidget data={data} />
    </EmbedFrame>
  )
}

