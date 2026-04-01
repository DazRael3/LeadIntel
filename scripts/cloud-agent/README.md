# Cloud agent environment optimization

These scripts make fresh cloud agents ready to run Node quality checks quickly:

- `npm run cloud:agent:prewarm`
  - Runs `npm ci` deterministically against `package-lock.json`.
  - Captures lockfile hash and installs a small marker file for cache validation.
- `npm run cloud:agent:verify-cache`
  - Verifies `node_modules` and marker/hash alignment with current lockfile.
  - Fast-fails with a clear remediation message when cache is stale.
- `npm run cloud:agent:ready`
  - Verifies dependency readiness, then runs:
    - `npm run typecheck`
    - `npm run lint`
    - `npm run test:unit -- --runInBand --passWithNoTests`

## Platform compatibility

- Uses Node scripts (`.mjs`) so commands work on Linux and Windows environments.
- No bash dependency required.
- On Windows, the scripts invoke `npm.cmd` / `npx.cmd` automatically.

## Recommended cloud-agent startup sequence

Use this startup script in your cloud agent environment config:

```bash
cd /workspace
npm run cloud:agent:verify-cache || npm run cloud:agent:prewarm
npm run cloud:agent:verify-cache
```

## Notes

- The readiness check is lockfile-bound. Any `package-lock.json` change invalidates cache automatically.
- Scripts use `process.cwd()` and work from repo root on Linux/Windows.
