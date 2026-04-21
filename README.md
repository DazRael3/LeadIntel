# LeadIntel

B2B Lead Intelligence Platform - AI-powered lead generation, personalized pitch creation, and intent tracking.

Built with Next.js (App Router), Supabase, Stripe, and OpenAI.

---

## Prerequisites

- **Node.js**: v20.x (LTS recommended)
- **Package Manager**: npm (comes with Node.js) or yarn/pnpm
- **Supabase Account**: [supabase.com](https://supabase.com) - Free tier works for development
- **Stripe Account**: [stripe.com](https://stripe.com) - Test mode for development
- **OpenAI Account**: [platform.openai.com](https://platform.openai.com) - API access required
- **Resend Account**: [resend.com](https://resend.com) - For email sending (optional for development)
- **Clearbit Account**: [clearbit.com](https://clearbit.com) - For company enrichment (optional)

---

## Local Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd LeadIntel
```

### 2. Install Dependencies

```bash
npm install
```

### Optional: Cloud agent dependency prewarm/readiness

For fresh cloud agents, use the lockfile-aware scripts to preinstall dependencies and verify cache readiness:

```bash
# Strictly installs from package-lock.json and records lock hash
npm run cloud:deps:prewarm

# Fast readiness check; runs npm ci only when lock hash changed or node_modules missing
npm run cloud:deps:verify
```

These scripts are in `scripts/cloud-agent/` and are optimized for quickly running:
- `npm run typecheck`
- `npm run lint`
- `npm run test:unit`

**Note for Windows Users**: Some antivirus/EDR software blocks `npm.ps1` shims. If you encounter this issue, use `npm.cmd` explicitly (or run via WSL/Linux).

### 3. Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local  # If .env.example exists
# Or create .env.local manually
```

Add the following environment variables (see sections below for details):

#### Supabase Configuration

```env
# Supabase Project URL (from Supabase Dashboard → Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Supabase Anon Key (public, safe for client-side)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Supabase Service Role Key (server-side only, NEVER expose to client)
# Get from Supabase Dashboard → Settings → API → service_role key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Database Schema (defaults to 'api' if not set)
NEXT_PUBLIC_SUPABASE_DB_SCHEMA=api
# Optional fallback schema
SUPABASE_DB_SCHEMA_FALLBACK=api
```

#### Stripe Configuration

```env
# Stripe Secret Key (server-side only)
# Test mode: sk_test_...
# Live mode: sk_live_...
STRIPE_SECRET_KEY=sk_test_your-secret-key-here

# Stripe Publishable Key (public, safe for client-side)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-publishable-key-here

# Stripe recurring price ID for Pro subscription ($99/month)
# Get from Stripe Dashboard → Products → Your Product → Pricing (Recurring)
STRIPE_PRICE_ID_PRO=price_your-pro-recurring-price-id-here

# Stripe Webhook Secret (for webhook signature verification)
# Get from Stripe Dashboard → Developers → Webhooks → Your endpoint → Signing secret
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret-here
```

#### OpenAI Configuration

```env
# OpenAI API Key
# Get from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-openai-api-key-here
```

#### Resend Configuration (Email Sending)

```env
# Resend API Key
# Get from https://resend.com/api-keys
RESEND_API_KEY=re_your-resend-api-key-here

# From email address (must be verified in Resend)
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

#### Clearbit Configuration (Company Enrichment)

```env
# Clearbit Reveal API Key (for Ghost Reveal - visitor identification)
# Get from https://dashboard.clearbit.com/api
CLEARBIT_REVEAL_API_KEY=your-clearbit-api-key-here

# Clearbit API Key (for company enrichment)
CLEARBIT_API_KEY=your-clearbit-api-key-here
```

#### Application Configuration

```env
# Site URL (for Stripe redirects and email links)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Node Environment (automatically set by Next.js, but can override)
NODE_ENV=development
```

---

## Optional: Analytics (PostHog)

Analytics are **fully optional**. If you do not set these env vars, tracking is a no-op and the app will not error.

```env
# Enable analytics capture (0/1)
NEXT_PUBLIC_ANALYTICS_ENABLED=1

# PostHog project API key (client-side)
NEXT_PUBLIC_POSTHOG_KEY=phc_...

# Optional PostHog host (defaults to https://app.posthog.com)
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Optional server key (if omitted, the server will fall back to NEXT_PUBLIC_POSTHOG_KEY)
POSTHOG_API_KEY=phc_...
```

### Tracked events (key ones)

- `landing_try_sample_submitted`
- `landing_sample_generated` (includes `score`)
- `landing_sample_email_requested`
- `landing_sample_email_sent`
- `cta_signup_clicked`
- `pricing_cta_clicked`

### Verify locally

- Set the env vars above in `.env.local`
- Start the app and trigger actions (homepage CTAs, sample generator, pricing CTA)
- Confirm events in PostHog “Live events”

---

## Optional: 1-minute demo asset

The homepage demo is intentionally implemented as an in-app `DemoLoop` preview to avoid referencing missing media assets in production builds.

## Inbound lead capture foundation

LeadIntel includes a first-party, consent-based inbound lead flow:

- Public forms post to `POST /api/lead-capture`
- Records are stored in `api.lead_captures` (RLS enabled)
- Inserts are deduped server-side with a daily `dedupe_key` hash (email + form + route)
- Optional confirmation email is sent when `RESEND_API_KEY` + `RESEND_FROM_EMAIL` are configured
- Confirmation sends are idempotent through `api.email_send_log` and `sendEmailDeduped`

### Required env for confirmation follow-up

```env
# Required to send confirmation emails
RESEND_API_KEY=re_your_resend_api_key
RESEND_FROM_EMAIL=team@yourdomain.com

# Optional, strongly recommended
RESEND_REPLY_TO_EMAIL=support@yourdomain.com
EMAIL_BRAND_IMAGE_URL=https://yourdomain.com/brand/logo-email.png
APP_URL=https://raelinfo.com

# Optional: net-new lead admin notifications (kept off by default)
LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED=1
LIFECYCLE_ADMIN_EMAILS=ops@dazrael.com
```

If Resend keys are not set, lead records are still saved and API responses remain successful; follow-up email status is reported as disabled.

### Consent + duplicate behavior

- Non-consent follow-up is strictly transactional (request acknowledgment + support link only; no marketing CTA content).
- Consent-enabled follow-up includes standard product next-step CTAs.
- Duplicate submissions (same daily dedupe key) still return success and now best-effort merge richer fields (`name`, `company`, `role`, `message`, attribution, consent metadata) onto the existing lead row when service-role access is available.
- Admin lead notifications use existing lifecycle admin email routing and only fire for net-new leads (not deduped repeats).

### Lead table fields (core)

`api.lead_captures` includes:

- `source_page`
- `form_type`
- `name`
- `email`
- `company`
- `role`
- `message`
- `consent_marketing`
- `consent_timestamp`
- `utm_source`, `utm_medium`, `utm_campaign`
- `referrer`
- `status`

### Local verification steps

1. Apply migrations: `supabase db push`
2. Start app: `npm run dev`
3. Submit a lead from `/contact` or `/pricing`
4. Verify row in Supabase:
   - `select created_at, email, form_type, source_page, consent_marketing, status from api.lead_captures order by created_at desc limit 20;`
5. If Resend is configured, verify send status:
   - `select created_at, to_email, template, status, provider_message_id from api.email_send_log order by created_at desc limit 20;`

#### Optional: Third-Party Integrations

```env
# Hunter.io API Key (for email verification)
HUNTER_API_KEY=your-hunter-api-key-here

# News API Key (for market pulse)
NEWS_API_KEY=your-news-api-key-here

# Zapier Webhook URL (for CRM push)
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/your-webhook-id/

# Admin Digest Secret (for scheduled digest webhook)
ADMIN_DIGEST_SECRET=your-secret-here

# Dev Seed Secret (for dev user creation - development only)
DEV_SEED_SECRET=... # generate a random secret; do not use a shared default
```

### 4. Database Setup

#### Run Migrations

**Recommended (Supabase CLI)**:

```bash
# Install Supabase CLI (one-time)
npx supabase --version

# Link the repo to your Supabase project
supabase link --project-ref <your-project-ref>

# Apply migrations in supabase/migrations/
supabase db push
```

**Alternative (Supabase Dashboard SQL Editor)**:

1. **List available migrations:**
   ```bash
   npm run migration list
   ```

2. **View a specific migration:**
   ```bash
   npm run migration 0004_digest_settings.sql
   ```

3. **Apply migrations in Supabase:**
   - Open [Supabase Dashboard](https://app.supabase.com) → SQL Editor
   - Copy the SQL from the migration file (or use `npm run migration <filename>`)
   - Paste and execute in SQL Editor
   - **Important**: After running migrations, refresh PostgREST schema cache:
     ```sql
     NOTIFY pgrst, 'reload schema';
     ```
   - Or restart Supabase API: Settings → API → Restart

4. **Verify schema:**
   - Check that tables exist in `api` schema (not `public`)
   - Verify RLS policies are enabled
   - Confirm indexes are created

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Common Commands

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server (after build)
npm run start

# Run linter
npm run lint

# Type check (no build)
npx tsc --noEmit
```

## Production deployment notes

See `docs/PRODUCTION_ENV.md` for the full production environment checklist (Stripe live keys, Supabase, Upstash rate limiting, and webhook setup).

### Database & Migrations

```bash
# List all migrations
npm run migration list

# View specific migration SQL
npm run migration <filename>

# Example: View digest settings migration
npm run migration 0004_digest_settings.sql
```

---

## Team plan features (workspaces, templates, audit logs)

Team features are exposed via the following settings pages (Team plan gated):

- `/settings/team`: Manage workspace members (invite, role changes, removals)
- `/settings/templates`: Workspace-governed template sets + approval workflow (draft vs approved)
- `/settings/audit`: Immutable audit log view with filters

Key behavior (production):

- **Plan gating**: Team settings are only available to users on the **Team** tier (an upgrade gate is shown otherwise).
- **Governance**: Only workspace **owner/admin** can invite members, change roles, approve templates, and manage integrations/exports.
- **Auditability**: Member/template/integration/export actions insert audit events (IP + user agent captured when available).

Database migrations for these live in `supabase/migrations/0036_*` and `supabase/migrations/0039_*` and create:

- `api.workspaces`, `api.workspace_members`, `api.workspace_invites`
- `api.template_sets`, `api.templates`
- `api.audit_logs`

## Integrations: Webhooks

Webhook endpoints are managed at `/settings/integrations` (Team plan gated). Deliveries are executed asynchronously via a cron-triggered runner.

### Signing

Each webhook delivery is sent as a JSON `POST` with headers:

- `X-LeadIntel-Event`: event type
- `X-LeadIntel-Timestamp`: unix seconds
- `X-LeadIntel-Signature`: `sha256=<hex>`

Signature algorithm:

- Compute `rawBody` as the exact request body string
- Verify:
  \[
  \text{sig} = \mathrm{HMAC\_SHA256}(\text{secret},\ \text{timestamp} \,||\, "." \,||\, \text{rawBody})
  \]

### Runner

- `POST /api/cron/webhooks` runs pending deliveries (due now) with exponential backoff and a 5s per-attempt timeout.

Webhook tables are created in:

- `supabase/migrations/0037_webhooks.sql`
- `supabase/migrations/0040_webhook_secret_records.sql` (stores raw secrets in `api.webhook_endpoint_secrets` and only hashes on `api.webhook_endpoints`)

## Integrations: Exports (CSV)

Exports are managed at `/settings/exports` (Team plan gated).

- Creating an export: `POST /api/exports/create` (server generates CSV and uploads it)
- Downloading: `GET /api/exports/[jobId]/download` (returns a short-lived signed URL in production)

Storage expectations:

- Create a **private** Supabase Storage bucket named `exports`
- CSV objects are stored as: `exports/{workspaceId}/{jobId}.csv`

Export jobs table is created in `supabase/migrations/0038_exports.sql`.

---

## E2E testing (Playwright)

E2E tests live in `tests/e2e/` and run via:

```bash
npm run test:e2e:install
npm run test:e2e
```

Windows PowerShell example:

```powershell
$env:E2E_BASE_URL="http://localhost:3000"
$env:E2E_EMAIL="you@example.com"
$env:E2E_PASSWORD="..."
$env:E2E_TEAM_EMAIL="team-owner@example.com"
$env:E2E_TEAM_PASSWORD="..."
$env:E2E_INVITEE_EMAIL="invitee@example.com"
$env:E2E_WEBHOOK_TARGET_URL="https://example-requestbin.com/..."
npm run test:e2e
```

More details: `docs/E2E_QUICK_START.md`

### Utility Scripts

```bash
# Run scraper script
npm run scraper

# Run marketing automation script
npm run marketing

# Run dry-run pitch generation (no DB writes)
npm run dry-run

# Apply migration (shows SQL for manual execution)
npm run migration
```

---

## Project Structure

```
LeadIntel/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   ├── login/             # Authentication
│   └── pricing/           # Pricing/subscription pages
├── components/            # React components
│   ├── ui/               # Reusable UI components (shadcn/ui)
│   └── ...               # Feature components
├── lib/                   # Utility libraries
│   ├── supabase/         # Supabase client helpers
│   ├── billing/          # Subscription logic
│   ├── ai-logic.ts       # OpenAI integration
│   └── stripe.ts         # Stripe client
├── supabase/
│   └── migrations/       # Database migrations
├── scripts/              # Utility scripts
└── docs/                 # Documentation
```

---

## Troubleshooting

### Windows PowerShell / npm.ps1 Issues

**"npm.ps1 blocked by antivirus" error:**
- **Cause**: Antivirus/EDR software blocks PowerShell script execution (`npm.ps1` shims)
- **Alternative**: Use `npm.cmd` explicitly:
  ```powershell
  & (Get-Command npm.cmd).Source install
  ```
  Then run e.g. `npm.cmd run verify:ready`.

**PowerShell execution policy errors:**
- If you see "execution of scripts is disabled", run:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

### Next.js Issues

**Build fails with TypeScript errors:**
```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

**Port 3000 already in use:**
```bash
# Use different port
PORT=3001 npm run dev
```

**Module not found errors:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Supabase Issues

**"Could not find column in schema cache" error:**
- Run migration in Supabase SQL Editor
- Refresh PostgREST schema cache: `NOTIFY pgrst, 'reload schema';`
- Restart Next.js dev server

**Authentication not working:**
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
- Check Supabase Dashboard → Authentication → Settings
- Clear browser cookies and localStorage

**RLS (Row Level Security) blocking queries:**
- Verify RLS policies are enabled: `SELECT * FROM pg_policies WHERE schemaname = 'api';`
- Check that user is authenticated: `SELECT auth.uid();`
- Review RLS policies in `supabase/schema.sql`

**Schema mismatch (api vs public):**
- Ensure all queries use `api` schema
- Check `NEXT_PUBLIC_SUPABASE_DB_SCHEMA=api` in `.env.local`
- Verify tables exist in `api` schema: `SELECT * FROM information_schema.tables WHERE table_schema = 'api';`

### Stripe Issues

**Webhook signature verification fails:**
- Verify `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint secret
- Check webhook URL is correct in Stripe Dashboard
- Ensure webhook endpoint uses `runtime = 'nodejs'` (not Edge)

**Checkout redirects to wrong URL:**
- Set `NEXT_PUBLIC_SITE_URL` in `.env.local`
- Verify Stripe Dashboard → Settings → Branding → Return URLs

**Subscription not updating after payment:**
- Check webhook is receiving events: Stripe Dashboard → Developers → Webhooks → Logs
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Check webhook handler logs for errors

### OpenAI Issues

**API key invalid:**
- Verify `OPENAI_API_KEY` is correct
- Check API key has credits/quota
- Ensure key starts with `sk-`

**Rate limit errors:**
- Check OpenAI usage dashboard
- Implement retry logic with exponential backoff
- Consider upgrading OpenAI plan

### Environment Variable Issues

**Variables not loading:**
- Ensure file is named `.env.local` (not `.env`)
- Restart dev server after changing `.env.local`
- Check variable names match exactly (case-sensitive)
- Verify `NEXT_PUBLIC_` prefix for client-side variables

**"Missing required environment variable" error:**
- Check all required variables are set in `.env.local`
- Verify no typos in variable names
- Ensure no extra spaces in values

---

## Development Workflow

1. **Create feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and test locally:**
   ```bash
   npm run dev
   ```

3. **Type check before committing:**
   ```bash
   npx tsc --noEmit
   ```

4. **Lint code:**
   ```bash
   npm run lint
   ```

5. **Commit and push:**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin feature/your-feature-name
   ```

---

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Project Documentation](./docs/)

---

## Lifecycle + Activation

LeadIntel includes a production activation checklist and lifecycle emails (welcome → nudges → recap → winback).

### Activation checklist (in-app)

The checklist is derived from real product state (server-side):
- Define ICP (stored in `api.user_settings`)
- Add 10 target accounts (count of `api.leads`)
- Generate first pitch draft (count of `api.pitches`)
- Turn on digest cadence (digest enabled + digest emails opt-in)

Completion is persisted to:
- `api.user_settings.checklist_state`
- `api.user_settings.checklist_completed_at`

### Email preferences

Users manage preferences at:
- `/settings/notifications`

Lifecycle emails only send when:
- `api.user_settings.product_tips_opt_in = true`

Digest delivery only emails when:
- `api.user_settings.digest_emails_opt_in = true` (webhooks are unaffected)

### Lifecycle cron

Lifecycle emails are sent via:
- `POST /api/cron/lifecycle`

Auth options:
- `x-cron-secret: $CRON_SECRET` header, or
- signed `cron_token` query param using `CRON_SIGNING_SECRET` (see `lib/api/cron-auth.ts`)

Recommended env vars:
- `CRON_SECRET` and/or `CRON_SIGNING_SECRET`
- `APP_URL` (falls back to `NEXT_PUBLIC_SITE_URL`, then `https://raelinfo.com`)
- `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (otherwise lifecycle runs no-op safely)

### Run locally

```bash
npm run lifecycle:run
```

---

## Growth Automation

LeadIntel includes a small jobs framework used by cron and the admin Growth Ops dashboard.

### Vercel Hobby automation (free)

- **Schedules are UTC**
- **Hobby cron jobs must run at most once per day** (weekly is fine). Hourly scheduling requires a paid plan.
- Lifecycle is kept timely with:
  - a **daily sweep** (`job=lifecycle`)
  - plus **lazy cron**: a best-effort per-user lifecycle check on normal authenticated activity

### External scheduler (cron-job.org)

If you want more frequent automation than Vercel Hobby allows, you can use `cron-job.org` (or similar) to call:
- `GET /api/cron/run?job=...`

Auth is required via header:
- `Authorization: Bearer $EXTERNAL_CRON_SECRET`

Rules:
- Secrets are **never** accepted via query params.
- For lifecycle batching: use `limit` (clamped to 10..1000; default 200), e.g. `job=lifecycle&limit=200`.

### Required env vars (by feature)

- **Cron protection**
  - `CRON_SECRET` (required for `POST /api/cron/run`)
  - `CRON_SIGNING_SECRET` (optional; used by other cron routes via `cron_token`)

- **Admin Growth Ops**
  - `ADMIN_TOKEN` (required to access `/admin/growth`; invalid/missing token returns 404)

- **Resend (email sending)**
  - `RESEND_API_KEY` (optional; if missing, email jobs skip safely)
  - `RESEND_FROM_EMAIL` (required to actually send)

- **KPI monitor (PostHog API reads)**
  - `POSTHOG_PROJECT_ID` (required to enable KPI reads)
  - `POSTHOG_PERSONAL_API_KEY` (required to enable KPI reads)
  - `POSTHOG_HOST` (optional; default `https://app.posthog.com`)
  - `ALERT_EMAIL_TO` (required to send alerts)

### Run locally

```bash
npm run content:audit
npm run lifecycle:run
```

### Trigger jobs (cron)

**Vercel Cron** calls the configured path using **GET** (timezone is **UTC**).
On the **Hobby** plan, schedules must be **daily or less frequent** (hourly requires a paid plan).

When `CRON_SECRET` is set in Vercel project env, Vercel sends:
- `Authorization: Bearer $CRON_SECRET`

Examples:
- `GET /api/cron/run?job=kpi_monitor`
- `GET /api/cron/run?job=content_audit`
- `GET /api/cron/run?job=lifecycle`
- `GET /api/cron/run?job=digest_lite`
- `GET /api/cron/run?job=growth_cycle&limit=3`

Optional:
- `dryRun=1` to skip side effects (returns a JobResult with `status:"skipped"` where supported)

For non-Vercel callers, `POST /api/cron/run` is still supported:
- preferred header: `Authorization: Bearer $CRON_SECRET`
- legacy header: `x-cron-secret: $CRON_SECRET`
- body: `{ "job": "kpi_monitor" | "content_audit" | "lifecycle" | "digest_lite" | "growth_cycle", "dryRun": false, "limit"?: number }`

### Recommended schedules

- lifecycle: hourly
- growth_cycle: every 6–12 hours (start at 12h; increase once content + opt-ins grow)
- digest_lite: weekly
- kpi_monitor: daily
- content_audit: daily


## Support

For issues and questions:
- Check [Troubleshooting](#troubleshooting) section above
- Review [docs/](./docs/) directory
- Open an issue in the repository

---

## License

MIT (see `LICENSE`)
