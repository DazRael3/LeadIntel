/* eslint-disable no-console -- CI script output */
const fs = require('fs')
const path = require('path')

// Build the needle without embedding it verbatim in the repo.
const NEEDLE = ['support', '@dazrael.com'].join('')
const IGNORE_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'out', '.vercel', '.turbo'])

function isIgnored(p) {
  const parts = p.split(path.sep)
  return parts.some((x) => IGNORE_DIRS.has(x))
}

function listFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (isIgnored(full)) continue
    if (e.isDirectory()) listFiles(full, out)
    else out.push(full)
  }
  return out
}

function isTextFile(p) {
  const ext = path.extname(p).toLowerCase()
  return [
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.json',
    '.md',
    '.txt',
    '.sql',
    '.yml',
    '.yaml',
    '.css',
    '.env',
    '.example',
  ].includes(ext)
}

function main() {
  const root = process.cwd()
  const files = listFiles(root).filter(isTextFile)
  const hits = []

  for (const f of files) {
    let text = ''
    try {
      text = fs.readFileSync(f, 'utf8')
    } catch {
      continue
    }
    if (text.includes(NEEDLE)) hits.push(path.relative(root, f))
  }

  if (hits.length > 0) {
    console.error(`Found forbidden legacy support email: ${NEEDLE}`)
    for (const h of hits) console.error(`- ${h}`)
    process.exitCode = 1
    return
  }

  console.log('OK: no legacy support email references found.')
}

main()

