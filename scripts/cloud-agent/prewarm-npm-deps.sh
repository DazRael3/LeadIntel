#!/usr/bin/env bash
set -euo pipefail

# Preinstalls Node dependencies based on package-lock.json and verifies
# that typecheck/lint/vitest tooling is immediately available.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

bash "$ROOT_DIR/scripts/cloud-agent/verify-npm-cache-readiness.sh"

echo "[cloud-agent] prewarm complete"
