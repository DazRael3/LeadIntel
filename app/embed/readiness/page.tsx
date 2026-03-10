import { verifyEmbedToken } from '@/lib/embed/security'
import { getEmbedReadiness } from '@/lib/embed/engine'
import { EmbedErrorState } from '@/components/embed/EmbedErrorState'
import { EmbedFrame } from '@/components/embed/EmbedFrame'
import { ActionReadinessWidget } from '@/components/embed/ActionReadinessWidget'

export const dynamic = 'force-dynamic'

export default async function EmbedReadinessPage(props: { searchParams: Promise<{ token?: string }> }) {
  const sp = await props.searchParams
  const token = (sp.token ?? '').trim()
  const payload = token ? verifyEmbedToken(token) : null
  if (!payload || payload.kind !== 'readiness') return <EmbedErrorState title="Embed invalid" detail="Token is invalid or expired." />

  const data = await getEmbedReadiness({ workspaceId: payload.workspaceId })
  return (
    <EmbedFrame title="Action readiness" subtitle="Embed-safe widget">
      <ActionReadinessWidget data={data} />
    </EmbedFrame>
  )
}

