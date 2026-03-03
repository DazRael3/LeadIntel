import { runLifecycleCron } from '@/lib/growth/lifecycle'

async function main() {
  const summary = await runLifecycleCron()
  // eslint-disable-next-line no-console -- CLI output
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((err) => {
  // eslint-disable-next-line no-console -- CLI output
  console.error(err)
  process.exitCode = 1
})

