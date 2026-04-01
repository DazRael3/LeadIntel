#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCKFILE="$ROOT_DIR/package-lock.json"
MODULES_LOCKFILE="$ROOT_DIR/node_modules/.package-lock.json"
STATE_DIR="$ROOT_DIR/.cache/cloud-agent"
LOCK_HASH_FILE="$STATE_DIR/npm-lock.sha256"

if [[ ! -f "$LOCKFILE" ]]; then
  echo "[agent:cache] package-lock.json is required for deterministic installs." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[agent:cache] Node.js is not available." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[agent:cache] npm is not available." >&2
  exit 1
fi

if [[ -f "$ROOT_DIR/.nvmrc" ]]; then
  required_major="$(tr -d '[:space:]' < "$ROOT_DIR/.nvmrc")"
  current_major="$(node -p "process.versions.node.split('.')[0]")"
  if [[ "$required_major" != "$current_major" ]]; then
    echo "[agent:cache] Warning: .nvmrc requests Node $required_major, current is $current_major." >&2
  fi
fi

mkdir -p "$STATE_DIR"
npm_cache_dir="$(npm config get cache)"
mkdir -p "$npm_cache_dir"

lock_hash="$(sha256sum "$LOCKFILE" | awk '{print $1}')"
warm_modules="false"

if [[ -f "$MODULES_LOCKFILE" ]] && cmp -s "$LOCKFILE" "$MODULES_LOCKFILE"; then
  if [[ -f "$LOCK_HASH_FILE" ]] && [[ "$(tr -d '[:space:]' < "$LOCK_HASH_FILE")" == "$lock_hash" ]]; then
    warm_modules="true"
  fi
fi

if [[ "$warm_modules" == "true" ]]; then
  echo "[agent:cache] node_modules is lockfile-aligned. Skipping npm ci."
else
  echo "[agent:cache] Installing dependencies with npm ci (prefer-offline)."
  (
    cd "$ROOT_DIR"
    npm ci --prefer-offline --no-audit --fund=false
  )
fi

echo "[agent:cache] Verifying npm cache integrity."
npm cache verify >/dev/null

echo "$lock_hash" > "$LOCK_HASH_FILE"

(
  cd "$ROOT_DIR"
  npx --no-install tsc --version >/dev/null
  npx --no-install next --version >/dev/null
  npx --no-install vitest --version >/dev/null
)

echo "[agent:cache] Ready: dependencies and toolchain are cache-warm."
