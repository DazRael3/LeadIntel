type Json = unknown

async function main() {
  const base = (process.env.CRON_TEST_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const secret = (process.env.CRON_TEST_SECRET ?? process.env.CRON_SECRET ?? '').trim()
  if (!secret) {
    // eslint-disable-next-line no-console -- CLI output
    console.error('Missing CRON_TEST_SECRET (or CRON_SECRET).')
    process.exitCode = 1
    return
  }

  const url = `${base}/api/cron/run?job=content_audit`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } })
  let json: Json = null
  try {
    json = await res.json()
  } catch {
    json = await res.text()
  }

  // eslint-disable-next-line no-console -- CLI output
  console.log('status:', res.status)
  // eslint-disable-next-line no-console -- CLI output
  console.log('response:', typeof json === 'string' ? json : JSON.stringify(json, null, 2))
}

main().catch((e) => {
  // eslint-disable-next-line no-console -- CLI output
  console.error(e)
  process.exitCode = 1
})

