# LeadIntel

B2B Lead Intelligence Platform - AI-powered lead generation, personalized pitch creation, and intent tracking.

Built with Next.js 14 (App Router), Supabase, Stripe, and OpenAI.

---

## Prerequisites

- **Node.js**: v18.x or v20.x (LTS recommended)
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
SUPABASE_DB_SCHEMA_FALLBACK=public
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
DEV_SEED_SECRET=dev-secret-change-me
```

### 4. Database Setup

#### Run Migrations

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

## Support

For issues and questions:
- Check [Troubleshooting](#troubleshooting) section above
- Review [docs/](./docs/) directory
- Open an issue in the repository

---

## License

[Add your license here]
