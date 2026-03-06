import { auditContent } from '@/lib/jobs/contentAudit'

async function main() {
  const res = auditContent(process.cwd())
  if (!res.ok) {
    // eslint-disable-next-line no-console -- CI output
    console.error('Content audit failed:')
    for (const f of res.failures) {
      // eslint-disable-next-line no-console -- CI output
      console.error(`- ${f.code}: ${f.message}${f.path ? ` (${f.path})` : ''}`)
    }
    process.exitCode = 1
    return
  }
  // eslint-disable-next-line no-console -- CI output
  console.log('Content audit ok:', JSON.stringify(res.summary, null, 2))
}

main().catch((err) => {
  // eslint-disable-next-line no-console -- CI output
  console.error(err)
  process.exitCode = 1
})

