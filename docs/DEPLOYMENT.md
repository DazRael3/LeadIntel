# Deployment Guide

Production deployment guide for LeadIntel SaaS application.

---

## Security & Dependencies

### Next.js Version Pinning

**Next.js is pinned to version 14.2.35** due to the December 11, 2025 RSC (React Server Components) security advisory.

This ensures production deployments use a patched release line with security fixes. Do not upgrade Next.js without:
1. Reviewing the latest security advisories
2. Testing thoroughly in staging
3. Verifying compatibility with all dependencies

**Important**: Always check for security advisories before upgrading Next.js or other critical dependencies.

---

## Overview

LeadIntel is a Next.js application that can be deployed to:
- **Vercel** (recommended for Next.js)
- **Netlify**
- **AWS** (via Amplify or EC2)
- **Railway**
- **Render**
- **Self-hosted** (Node.js server)

This guide focuses on **Vercel** (recommended) and **staging/production** environment management.

---

## Environment Setup

### Staging vs Production

Maintain separate environments for staging and production:

| Environment | Purpose | Database | Stripe Mode | Domain |
|------------|---------|----------|-------------|--------|
| **Development** | Local development | Supabase (dev project) | Test mode | `localhost:3000` |
| **Staging** | Pre-production testing | Supabase (staging project) | Test mode | `staging.leadintel.com` |
| **Production** | Live application | Supabase (prod project) | Live mode | `leadintel.com` |

### Environment Variables by Environment

#### Staging Environment Variables

```env
# Supabase (Staging Project)
NEXT_PUBLIC_SUPABASE_URL=https://staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=staging-anon-key
SUPABASE_SERVICE_ROLE_KEY=staging-service-role-key
NEXT_PUBLIC_SUPABASE_DB_SCHEMA=api

# Stripe (Test Mode)
STRIPE_SECRET_KEY=sk_test_staging-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_staging-key
STRIPE_PRICE_ID=price_test_staging-price-id
STRIPE_WEBHOOK_SECRET=whsec_staging-webhook-secret

# OpenAI (Same key, but monitor usage separately)
OPENAI_API_KEY=sk-production-key

# Resend
RESEND_API_KEY=re_staging-key
RESEND_FROM_EMAIL=noreply@staging.leadintel.com

# Clearbit
CLEARBIT_REVEAL_API_KEY=staging-key
CLEARBIT_API_KEY=staging-key

# Application
NEXT_PUBLIC_SITE_URL=https://staging.leadintel.com
NODE_ENV=production
```

#### Production Environment Variables

```env
# Supabase (Production Project)
NEXT_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=prod-anon-key
SUPABASE_SERVICE_ROLE_KEY=prod-service-role-key
NEXT_PUBLIC_SUPABASE_DB_SCHEMA=api

# Stripe (Live Mode)
STRIPE_SECRET_KEY=sk_live_prod-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_prod-key
STRIPE_PRICE_ID=price_prod-price-id
STRIPE_WEBHOOK_SECRET=whsec_prod-webhook-secret

# OpenAI
OPENAI_API_KEY=sk-production-key

# Resend
RESEND_API_KEY=re_prod-key
RESEND_FROM_EMAIL=noreply@leadintel.com

# Clearbit
CLEARBIT_REVEAL_API_KEY=prod-key
CLEARBIT_API_KEY=prod-key

# Application
NEXT_PUBLIC_SITE_URL=https://leadintel.com
NODE_ENV=production
```

---

## Deployment to Vercel

### Prerequisites

1. **Vercel Account**: [vercel.com](https://vercel.com)
2. **GitHub/GitLab/Bitbucket** repository connected
3. **Vercel CLI** (optional, for local deployment):
   ```bash
   npm i -g vercel
   ```

### Initial Deployment

#### Option 1: Vercel Dashboard (Recommended)

1. **Import Project:**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your Git repository
   - Select framework: **Next.js**

2. **Configure Build Settings:**
   - Framework Preset: `Next.js`
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
   - Install Command: `npm install` (default)

3. **Set Environment Variables:**
   - Add all environment variables from [Environment Variables](#environment-variables-by-environment) section
   - **Important**: Set variables for each environment (Production, Preview, Development)
   - Use Vercel's environment variable UI to set per-environment values

4. **Deploy:**
   - Click "Deploy"
   - Wait for build to complete
   - Visit the deployment URL

#### Option 2: Vercel CLI (Repeatable Deployment)

**Step 1: Install and Login**
```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel account
vercel login
```

**Step 2: Link Project**
```bash
# Navigate to project directory
cd /path/to/lead-intel-portal

# Link to existing Vercel project (or create new one)
vercel link

# Follow prompts:
# - Set up and deploy? Y
# - Which scope? [Select your Vercel account/team]
# - Link to existing project? [Y if project exists, N to create new]
# - What's your project's name? lead-intel-portal (or your project name)
# - In which directory is your code located? ./
```

**Step 3: Set Environment Variables for Staging**

```bash
# Set staging environment variables (Preview environment)
# Repeat for each variable from the required list below

vercel env add NEXT_PUBLIC_SUPABASE_URL preview
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
vercel env add SUPABASE_SERVICE_ROLE_KEY preview
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY preview
vercel env add STRIPE_SECRET_KEY preview
vercel env add STRIPE_WEBHOOK_SECRET preview
vercel env add OPENAI_API_KEY preview
vercel env add UPSTASH_REDIS_REST_URL preview
vercel env add UPSTASH_REDIS_REST_TOKEN preview

# Optional variables (set if needed)
vercel env add RESEND_API_KEY preview
vercel env add RESEND_FROM_EMAIL preview
vercel env add NEXT_PUBLIC_SITE_URL preview
```

**Step 4: Set Environment Variables for Production**

```bash
# Set production environment variables
# Repeat for each variable from the required list below

vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add OPENAI_API_KEY production
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production

# Optional variables (set if needed)
vercel env add RESEND_API_KEY production
vercel env add RESEND_FROM_EMAIL production
vercel env add NEXT_PUBLIC_SITE_URL production
```

**Step 5: Deploy Staging**

```bash
# Deploy to preview/staging environment
vercel

# Or deploy to specific branch
vercel --target staging
```

**Step 6: Deploy Production**

```bash
# Deploy to production
vercel --prod

# Or deploy from specific branch
vercel --prod --target main
```

**Alternative: Bulk Set Environment Variables from File**

Create `.env.staging` and `.env.production` files with all variables, then:

```bash
# Load and set all staging variables from file
# Note: Vercel CLI doesn't support bulk import directly
# Use Vercel Dashboard or set individually as shown above

# For automation, use Vercel API or terraform/vercel provider
```

**Verify Deployment**

```bash
# List all environment variables for a project
vercel env ls

# Pull environment variables (for local .env.local)
vercel env pull .env.local
```

### Environment Variables in Vercel

1. **Go to Project Settings → Environment Variables**
2. **Add each variable:**
   - Key: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: Your Supabase URL
   - Environment: Select (Production, Preview, Development)
3. **Repeat for all variables**

**Best Practice**: Use Vercel's environment variable groups to manage staging vs production:
- Create separate projects for staging and production
- Or use environment-specific variables in the same project

### Continuous Deployment

Vercel automatically deploys on:
- **Push to `main` branch** → Production deployment
- **Push to other branches** → Preview deployment
- **Pull requests** → Preview deployment

**Configure in**: Project Settings → Git → Production Branch

---

## Stripe Webhook Configuration

### Webhook Endpoint Setup

Stripe webhooks must be configured for each environment (staging and production).

#### Staging Webhook

1. **Get Staging Webhook URL:**
   ```
   https://staging.leadintel.com/api/stripe/webhook
   ```

2. **Configure in Stripe Dashboard:**
   - Go to [Stripe Dashboard](https://dashboard.stripe.com) → **Test Mode**
   - Navigate to: Developers → Webhooks
   - Click "Add endpoint"
   - Endpoint URL: `https://staging.leadintel.com/api/stripe/webhook`
   - Events to send:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`

3. **Get Webhook Signing Secret:**
   - After creating endpoint, click on it
   - Copy "Signing secret" (starts with `whsec_`)
   - Add to Vercel environment variables: `STRIPE_WEBHOOK_SECRET`

#### Production Webhook

1. **Get Production Webhook URL:**
   ```
   https://leadintel.com/api/stripe/webhook
   ```

2. **Configure in Stripe Dashboard:**
   - Go to [Stripe Dashboard](https://dashboard.stripe.com) → **Live Mode**
   - Navigate to: Developers → Webhooks
   - Click "Add endpoint"
   - Endpoint URL: `https://leadintel.com/api/stripe/webhook`
   - Events to send: Same as staging

3. **Get Webhook Signing Secret:**
   - Copy signing secret
   - Add to Vercel production environment variables

### Webhook Testing

**Test webhook locally using Stripe CLI:**

```bash
# Install Stripe CLI
# macOS: brew install stripe/stripe-cli/stripe
# Linux/Windows: See https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test event
stripe trigger checkout.session.completed
```

**Verify webhook in Stripe Dashboard:**
- Go to Developers → Webhooks → Your endpoint
- Check "Recent events" for successful deliveries
- Review logs for any errors

---

## Supabase Migration Workflow

### Migration Strategy

1. **Development**: Test migrations locally on dev Supabase project
2. **Staging**: Apply to staging Supabase project
3. **Production**: Apply to production Supabase project

### Migration Workflow

#### Step 1: Create Migration

1. **Create migration file:**
   ```bash
   # Create new migration file
   touch supabase/migrations/0008_your_migration_name.sql
   ```

2. **Write migration SQL:**
   ```sql
   -- LeadIntel: Description of what this migration does
   -- Date: YYYY-MM-DD
   
   BEGIN;
   
   -- Your migration SQL here
   -- Always use IF NOT EXISTS / IF EXISTS for idempotency
   
   COMMIT;
   ```

3. **Test locally:**
   ```bash
   # View migration
   npm run migration 0008_your_migration_name.sql
   
   # Apply in Supabase SQL Editor (dev project)
   # Then refresh schema cache
   ```

#### Step 2: Apply to Staging

1. **Deploy code to staging** (migration file included)
2. **Apply migration in Supabase:**
   - Open Staging Supabase Dashboard → SQL Editor
   - Copy migration SQL (or use `npm run migration <filename>`)
   - Paste and execute
   - **Refresh PostgREST schema cache:**
     ```sql
     NOTIFY pgrst, 'reload schema';
     ```
3. **Verify:**
   - Check tables/columns exist
   - Test affected features
   - Monitor for errors

#### Step 3: Apply to Production

1. **Deploy code to production** (migration file included)
2. **Schedule maintenance window** (if needed for breaking changes)
3. **Apply migration in Supabase:**
   - Open Production Supabase Dashboard → SQL Editor
   - Copy migration SQL
   - Paste and execute
   - **Refresh PostgREST schema cache:**
     ```sql
     NOTIFY pgrst, 'reload schema';
     ```
4. **Verify:**
   - Check tables/columns exist
   - Test affected features
   - Monitor error logs
   - Check user-facing features

### Migration Best Practices

1. **Always make migrations idempotent:**
   ```sql
   -- ✅ GOOD
   DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'api' AND table_name = 'users' AND column_name = 'new_column'
     ) THEN
       ALTER TABLE api.users ADD COLUMN new_column TEXT;
     END IF;
   END $$;
   ```

2. **Use transactions:**
   ```sql
   BEGIN;
   -- Your changes
   COMMIT;
   ```

3. **Test rollback plan** (for critical migrations):
   - Document how to reverse the migration
   - Test rollback in staging first

4. **Never modify existing migrations** (once applied to production):
   - Create new migration to fix issues
   - Document in migration comments

5. **Backup before production migrations:**
   - Use Supabase Dashboard → Database → Backups
   - Or create manual backup: `pg_dump`

### PostgREST Schema Cache

**Critical**: After every migration, refresh PostgREST schema cache:

```sql
NOTIFY pgrst, 'reload schema';
```

**Why**: PostgREST caches the database schema. Without refreshing, new columns/tables won't be accessible via API.

**Alternative**: Restart Supabase API in dashboard (Settings → API → Restart)

---

## Database Management

### Supabase Project Setup

#### Staging Project

1. **Create new Supabase project** for staging
2. **Apply all migrations** (in order)
3. **Configure RLS policies** (from `supabase/schema.sql`)
4. **Set up backups**: Daily automated backups
5. **Configure environment variables** in Vercel

#### Production Project

1. **Create new Supabase project** for production
2. **Apply all migrations** (in order)
3. **Configure RLS policies**
4. **Set up backups**: Daily automated backups + point-in-time recovery
5. **Configure environment variables** in Vercel
6. **Enable monitoring**: Set up alerts for errors

### Database Backups

**Supabase Automatic Backups:**
- Free tier: 7 days retention
- Pro tier: 30 days retention
- Enterprise: Custom retention

**Manual Backup:**
```bash
# Using Supabase CLI (if installed)
supabase db dump -f backup.sql

# Or use Supabase Dashboard → Database → Backups
```

---

## Monitoring & Alerts

### Vercel Monitoring

1. **Enable Vercel Analytics** (optional):
   - Project Settings → Analytics
   - Enable Web Analytics

2. **Set up Error Tracking:**
   - Integrate Sentry or similar
   - Configure error alerts

3. **Monitor Deployments:**
   - Check deployment logs for errors
   - Set up deployment notifications

### Supabase Monitoring

1. **Database Metrics:**
   - Supabase Dashboard → Database → Metrics
   - Monitor query performance
   - Check connection pool usage

2. **API Metrics:**
   - Supabase Dashboard → API → Metrics
   - Monitor request rate
   - Check error rates

3. **Set up Alerts:**
   - Database connection errors
   - High error rates
   - Unusual traffic spikes

### Stripe Monitoring

1. **Webhook Logs:**
   - Stripe Dashboard → Developers → Webhooks
   - Monitor webhook delivery success rate
   - Check for failed deliveries

2. **Payment Monitoring:**
   - Monitor failed payments
   - Check subscription status changes
   - Review customer portal usage

---

## Rollback Procedures

### Code Rollback (Vercel)

1. **Revert to previous deployment:**
   - Vercel Dashboard → Deployments
   - Find previous successful deployment
   - Click "..." → "Promote to Production"

2. **Or redeploy previous commit:**
   ```bash
   git checkout <previous-commit-hash>
   git push --force origin main
   ```

### Database Rollback

1. **If migration failed:**
   - Restore from backup (Supabase Dashboard → Database → Backups)
   - Or manually reverse migration SQL

2. **If data corruption:**
   - Restore from most recent backup
   - Investigate root cause
   - Fix and re-apply migration

---

## Troubleshooting

### Deployment Issues

**Build fails:**
- Check build logs in Vercel
- Verify all environment variables are set
- Ensure Node.js version is compatible (18.x or 20.x)

**Environment variables not loading:**
- Verify variables are set for correct environment (Production/Preview)
- Check variable names match exactly (case-sensitive)
- Restart deployment after adding variables

### Webhook Issues

**Webhook not receiving events:**
- Verify webhook URL is correct in Stripe Dashboard
- Check webhook endpoint is accessible (not blocked by firewall)
- Review Stripe webhook logs for delivery failures

**Webhook signature verification fails:**
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
- Check webhook endpoint uses `runtime = 'nodejs'` (not Edge)
- Ensure raw body is used for signature verification

### Database Issues

**Schema cache not updating:**
- Run `NOTIFY pgrst, 'reload schema';` in Supabase SQL Editor
- Or restart Supabase API

**RLS blocking queries:**
- Verify RLS policies are correct
- Check user authentication status
- Review policy definitions in `supabase/schema.sql`

---

## Security Checklist

Before deploying to production:

- [ ] All environment variables are set correctly
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is server-side only (not exposed to client)
- [ ] `STRIPE_SECRET_KEY` is server-side only
- [ ] Webhook secrets are configured for each environment
- [ ] RLS policies are enabled on all tables
- [ ] Database backups are configured
- [ ] Error tracking is set up (Sentry, etc.)
- [ ] Monitoring and alerts are configured
- [ ] SSL/TLS is enabled (automatic with Vercel)
- [ ] Domain is configured and DNS is correct

---

## Next Steps

After deployment:

1. **Test critical flows:**
   - User signup/login
   - Subscription checkout
   - Webhook processing
   - AI pitch generation
   - Email sending

2. **Monitor for 24-48 hours:**
   - Check error logs
   - Monitor webhook deliveries
   - Review user feedback

3. **Set up ongoing maintenance:**
   - Regular dependency updates
   - Security patches
   - Performance optimization

---

## Required Environment Variables

### Production-Required Variables

The following environment variables **must** be set in production. The application will **fail to start** if any are missing (fail-closed):

#### Supabase (Required)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (public)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-only secret)

#### Stripe (Required)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key (public, starts with `pk_`)
- `STRIPE_SECRET_KEY` - Stripe secret key (server-only secret, starts with `sk_`)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret (starts with `whsec_`)

#### OpenAI (Required)
- `OPENAI_API_KEY` - OpenAI API key (server-only secret, starts with `sk-`)

#### Upstash Redis (Required in Production)
- `UPSTASH_REDIS_REST_URL` - Upstash Redis REST API URL
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis REST API token

### Optional Variables

The following variables are optional and can be set based on your needs:

#### Application
- `NEXT_PUBLIC_SITE_URL` - Your site URL (e.g., `https://leadintel.com`)
- `NEXT_PUBLIC_SUPABASE_DB_SCHEMA` - Database schema name (defaults to `api`)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins

#### Resend (Email)
- `RESEND_API_KEY` - Resend API key (starts with `re_`)
- `RESEND_FROM_EMAIL` - Default sender email address

#### Stripe (Optional)
- `STRIPE_PRICE_ID` - Stripe price ID for subscriptions
- `STRIPE_PRICE_ID_PRO` - Stripe price ID for Pro tier

#### Clearbit (Optional)
- `CLEARBIT_REVEAL_API_KEY` - Clearbit Reveal API key
- `CLEARBIT_API_KEY` - Clearbit API key

#### Third-Party Integrations (Optional)
- `HUNTER_API_KEY` - Hunter.io API key
- `NEWS_API_KEY` - News API key
- `ZAPIER_WEBHOOK_URL` - Zapier webhook URL for CRM integration
- `ADMIN_DIGEST_SECRET` - Admin digest cron secret

#### Observability (Optional)
- `SENTRY_DSN` - Sentry DSN for error tracking
- `SENTRY_ENVIRONMENT` - Sentry environment name
- `SENTRY_TRACES_SAMPLE_RATE` - Sentry traces sample rate (0-1)

#### Development (Optional, not used in production)
- `DEV_SEED_SECRET` - Development seed secret for dev-only routes

### Runtime Validation

The application validates all required environment variables at startup:
- **Development**: Shows warnings for missing optional variables
- **Production**: **Fails to start** if any required variables are missing (fail-closed)

Production will **block deployment** if these are missing:
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

---

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Deployment Guide](https://supabase.com/docs/guides/hosting)
- [Stripe Webhook Guide](https://stripe.com/docs/webhooks)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Upstash Redis Setup](https://upstash.com/docs/redis/overall/getstarted)
