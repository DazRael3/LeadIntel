#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..', '..')
const lockfile = join(rootDir, 'package-lock.json')
const modulesLockfile = join(rootDir, 'node_modules', '.package-lock.json')
const stateDir = join(rootDir, '.cache', 'cloud-agent')
const lockHashFile = join(stateDir, 'npm-lock.sha256')
const installedLockSnapshot = join(stateDir, 'package-lock.installed.snapshot.json')
const nvmrc = join(rootDir, '.nvmrc')

function fail(message) {
  console.error(message)
  process.exit(1)
}

function run(command, args, options = {}) {
  const baseOptions = {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
    ...options,
  }
  const result =
    process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', `${command} ${args.map(quoteForCmd).join(' ')}`], baseOptions)
      : spawnSync(command, args, baseOptions)
  if (result.error) {
    fail(`[agent:cache] Failed running "${command} ${args.join(' ')}": ${result.error.message}`)
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status)
  }
}

function resolveExecutable(baseName) {
  if (process.platform === 'win32') return baseName
  return baseName
}

function quoteForCmd(arg) {
  if (/^[A-Za-z0-9_./:-]+$/.test(arg)) return arg
  return `"${String(arg).replace(/"/g, '\\"')}"`
}

if (!existsSync(lockfile)) {
  fail('[agent:cache] package-lock.json is required for deterministic installs.')
}

if (existsSync(nvmrc)) {
  const requiredMajor = readFileSync(nvmrc, 'utf8').trim()
  const currentMajor = process.versions.node.split('.')[0]
  if (requiredMajor && requiredMajor !== currentMajor) {
    console.error(`[agent:cache] Warning: .nvmrc requests Node ${requiredMajor}, current is ${currentMajor}.`)
  }
}

mkdirSync(stateDir, { recursive: true })

const lockHash = createHash('sha256').update(readFileSync(lockfile)).digest('hex')
let warmModules = false

if (existsSync(modulesLockfile) && existsSync(lockHashFile)) {
  const rootLock = readFileSync(lockfile)
  const installedLock = existsSync(installedLockSnapshot)
    ? readFileSync(installedLockSnapshot)
    : readFileSync(modulesLockfile)
  const savedHash = readFileSync(lockHashFile, 'utf8').trim()
  if (Buffer.compare(rootLock, installedLock) === 0 && savedHash === lockHash) {
    warmModules = true
  }
}

if (warmModules) {
  console.log('[agent:cache] node_modules is lockfile-aligned. Skipping npm ci.')
} else {
  console.log('[agent:cache] Installing dependencies with npm ci (prefer-offline).')
  run(resolveExecutable('npm'), ['ci', '--prefer-offline', '--no-audit', '--fund=false'])
}

console.log('[agent:cache] Verifying npm cache integrity.')
run(resolveExecutable('npm'), ['cache', 'verify'])

writeFileSync(lockHashFile, `${lockHash}\n`, 'utf8')
cpSync(lockfile, installedLockSnapshot)

run(resolveExecutable('npx'), ['--no-install', 'tsc', '--version'])
run(resolveExecutable('npx'), ['--no-install', 'next', '--version'])
run(resolveExecutable('npx'), ['--no-install', 'vitest', '--version'])

console.log('[agent:cache] Ready: dependencies and toolchain are cache-warm.')
