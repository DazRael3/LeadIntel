# Audits

This folder stores **human-readable audit summaries** that are safe to commit.

Raw audit artifacts (screenshots, storage state, HTML snapshots) are intentionally excluded from git via `.gitignore` (see `/admin-reports/`).

## How to regenerate the public-site audit

From the repo root:

```bash
AUDIT_BASE_URL="https://dazrael.com" AUDIT_SCOPE="public" npm run audit:ai
```

Then review the generated report under `admin-reports/ai-site-audit/...` and update the latest summary in this folder.

