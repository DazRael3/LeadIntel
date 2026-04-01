#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const verifyScript = path.resolve(__dirname, 'verify-npm-cache-readiness.mjs')

const result = spawnSync(process.execPath, [verifyScript], {
  stdio: 'inherit',
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

console.log('[cloud-agent] prewarm complete')
